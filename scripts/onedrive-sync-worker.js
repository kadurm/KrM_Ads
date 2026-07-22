/**
 * KrM_Ads - Standalone OneDrive CRM Sync Worker (Shadow Mode)
 * 
 * Executa a extração, sanitização (ETL) e upsert idempotente
 * de dados de planilhas Excel mensais do OneDrive para a tabela LeadSolution.
 */

const fs = require('fs');
const path = require('path');

// --- 1. CARREGAMENTO DE VARIÁVEIS DE AMBIENTE ---
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) return;
      const key = trimmed.substring(0, eqIdx).trim();
      let val = trimmed.substring(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    });
    console.log('✅ Arquivo .env carregado localmente.');
  }
} catch (e) {
  console.warn('⚠️ Não foi possível ler .env local:', e.message);
}

// Direcionar conexão para a direct URL se rodando via CLI/Actions
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// --- 2. MAPEAMENTO DE CABEÇALHOS OPERACIONAIS ---
const COLUMN_MAPPING = {
  data: ['data', 'date', 'dia'],
  nome_cliente: ['nome do cliente', 'nome cliente', 'cliente', 'nome'],
  telefone: ['telefone', 'tel', 'whatsapp', 'contato'],
  origem: ['origem', 'origem (veio insta/site)', 'veio insta/site', 'veio de onde'],
  primeira_mensagem: ['primeira mensagem', 'primeira msg', 'mensagem', 'msg'],
  tipo_servico: ['tipo de serviço', 'tipo servico', 'serviço', 'servico'],
  veiculo: ['veículo', 'veiculo', 'carro', 'veiculos'],
  comercial: ['comercial', 'vendedor', 'atendente', 'comercial/atendente'],
  conversao: ['conversão', 'conversao'],
  status: ['status', 'situação', 'situacao', 'status lead'],
  valor_faturado: ['valor faturado', 'faturamento', 'valor', 'faturado', 'preço', 'preco']
};

// --- 3. FUNÇÕES AUXILIARES DE RESILIÊNCIA DA API MICROSOFT GRAPH ---
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Obter token OAuth via Client Credentials Flow
async function getMicrosoftGraphToken() {
  const tenantId = process.env.ONEDRIVE_TENANT_ID;
  const clientId = process.env.ONEDRIVE_CLIENT_ID;
  const clientSecret = process.env.ONEDRIVE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('❌ Configurações do OneDrive/Azure AD ausentes no ambiente.');
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('scope', 'https://graph.microsoft.com/.default');

  console.log('📡 Solicitando token de acesso do Microsoft Graph...');
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Erro na autenticação OAuth: ${res.statusText} - ${errorText}`);
  }

  const data = await res.json();
  console.log('✅ Token Microsoft Graph gerado com sucesso.');
  return data.access_token;
}

// Wrapper de chamadas fetch com retentativas e Exponential Backoff
async function fetchWithRetry(url, options = {}, maxAttempts = 5) {
  let attempts = 0;
  let delayTime = 1000;

  while (attempts < maxAttempts) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        // Tratar erro de limite de requisições (HTTP 429) ou problemas do servidor
        if ((res.status === 429 || res.status >= 500) && attempts < maxAttempts - 1) {
          attempts++;
          const jitter = Math.random() * 500;
          console.warn(`⚠️ [Graph API Error ${res.status}] Retentativa ${attempts}/${maxAttempts} em ${delayTime + jitter}ms...`);
          await delay(delayTime + jitter);
          delayTime *= 2;
          continue;
        }
        throw new Error(`Graph API retornou HTTP ${res.status}: ${res.statusText}`);
      }
      return await res.json();
    } catch (err) {
      if (attempts < maxAttempts - 1) {
        attempts++;
        console.warn(`⚠️ [Falha de Conexão] ${err.message}. Retentativa ${attempts}/${maxAttempts} em ${delayTime}ms...`);
        await delay(delayTime);
        delayTime *= 2;
        continue;
      }
      throw err;
    }
  }
}

// --- 4. FUNÇÕES DE SANITIZAÇÃO E ETL ---

// Sanitiza telefone para manter apenas números
function sanitizeTelefone(telefone) {
  if (telefone === null || telefone === undefined) return null;
  const cleaned = String(telefone).replace(/\D/g, '');
  
  // Um número de telefone celular no Brasil deve possuir pelo menos 10 ou 11 dígitos (DDD + número)
  // Mas aceitamos de 8 a 15 dígitos para casos especiais e telefones fixos/estrangeiros
  if (cleaned.length >= 8 && cleaned.length <= 15) {
    return cleaned;
  }
  return null;
}

// Trata marcações operacionais como "X" ou "x" ou "-" para null
function cleanOperationalMark(val) {
  if (val === null || val === undefined) return null;
  const valStr = String(val).trim();
  if (!valStr || ['x', 'x', '-', 'nulo', 'null', ''].includes(valStr.toLowerCase())) {
    return null;
  }
  return valStr;
}

// Trata e faz o parsing de data suportando serial dates do Excel e formatos de string BR e ISO
function parseDate(dateVal, sheetName) {
  if (dateVal === null || dateVal === undefined) return null;
  
  let valStr = String(dateVal).trim();
  if (!valStr || ['x', 'x', '-', 'nulo', 'null', ''].includes(valStr.toLowerCase())) {
    return null;
  }

  // 1. Tratamento para Número Serial do Excel
  if (!isNaN(valStr) && Number(valStr) > 20000) {
    const excelSerial = Number(valStr);
    const date = new Date(Math.round((excelSerial - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // 2. Formato DD/MM/YYYY ou DD-MM-YYYY
  let match = valStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (match) {
    let day = parseInt(match[1], 10);
    let month = parseInt(match[2], 10) - 1;
    let year = parseInt(match[3], 10);
    if (year < 100) year += 2000; // Tratamento de ano de 2 dígitos
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // 3. Formato YYYY-MM-DD
  match = valStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (match) {
    let year = parseInt(match[1], 10);
    let month = parseInt(match[2], 10 - 1);
    let day = parseInt(match[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // 4. Parse nativo como fallback
  const parsed = new Date(valStr);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  // 5. Fallback baseado no nome da aba mensal (Ex: "MAIO 2026")
  if (sheetName) {
    const sheetMatch = sheetName.match(/^(JANEIRO|FEVEREIRO|MARÇO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)\s+(\d{4})$/i);
    if (sheetMatch) {
      const monthNames = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
      const monthIdx = monthNames.indexOf(sheetMatch[1].toLowerCase());
      const year = parseInt(sheetMatch[2], 10);
      if (monthIdx !== -1) {
        return new Date(year, monthIdx, 1);
      }
    }
  }

  return null;
}

// Trata valor faturado, convertendo string BR ou decimal para Number
function parseCurrency(val) {
  if (val === null || val === undefined) return 0.0;
  let valStr = String(val).trim();
  if (!valStr || ['x', 'x', '-', 'nulo', 'null', ''].includes(valStr.toLowerCase())) {
    return 0.0;
  }

  // Remover cifrão, espaços e pontos de milhar
  valStr = valStr.replace(/R\$\s*/i, '').replace(/\s/g, '');

  if (valStr.includes(',') && valStr.includes('.')) {
    if (valStr.indexOf('.') < valStr.indexOf(',')) {
      // Padrão BR (1.500,00): remove ponto e troca vírgula por ponto
      valStr = valStr.replace(/\./g, '').replace(',', '.');
    } else {
      // Padrão US (1,500.00): remove vírgulas
      valStr = valStr.replace(/,/g, '');
    }
  } else if (valStr.includes(',')) {
    // Apenas vírgula como separador
    valStr = valStr.replace(',', '.');
  }

  const num = parseFloat(valStr);
  return isNaN(num) ? 0.0 : num;
}

// --- 5. DETECÇÃO E MAPEAMENTO DINÂMICO DE COLUNAS ---
function mapHeaderIndexes(headerRow) {
  const indexMap = {};
  
  // Inicializa com null
  Object.keys(COLUMN_MAPPING).forEach(key => {
    indexMap[key] = -1;
  });

  headerRow.forEach((cell, idx) => {
    if (!cell) return;
    const cleanCell = cell.toString().trim().toLowerCase();
    
    // Busca em qual mapeamento essa célula se encaixa
    Object.entries(COLUMN_MAPPING).forEach(([field, aliases]) => {
      if (aliases.includes(cleanCell)) {
        indexMap[field] = idx;
      }
    });
  });

  return indexMap;
}

// --- 6. ORQUESTRADOR DE SINCRONIZAÇÃO (MAIN FLOW) ---
async function syncOneDriveCRM() {
  const userId = process.env.ONEDRIVE_USER_ID;
  const filePath = process.env.ONEDRIVE_FILE_PATH;

  if (!userId || !filePath) {
    throw new Error('❌ Variáveis de ambiente ONEDRIVE_USER_ID ou ONEDRIVE_FILE_PATH não configuradas.');
  }

  console.log(`🚀 Iniciando Shadow Mode CRM Integration: OneDrive -> PostgreSQL`);
  console.log(`   Usuário: ${userId}`);
  console.log(`   Caminho do arquivo: ${filePath}`);

  // 1. Obter Token OAuth
  const accessToken = await getMicrosoftGraphToken();
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/json'
  };

  // 2. Buscar worksheets (abas) da planilha no OneDrive
  const fileEndpoint = `https://graph.microsoft.com/v1.0/users/${userId}/drive/root:${filePath}:/workbook/worksheets`;
  console.log(`📡 Solicitando abas da planilha...`);
  const sheetsResponse = await fetchWithRetry(fileEndpoint, { headers });
  
  if (!sheetsResponse || !sheetsResponse.value) {
    throw new Error('❌ Nenhuma aba encontrada ou formato de resposta inválido.');
  }

  // Filtrar abas mensais (ex: "MAIO 2026", "JUNHO 2026")
  const monthlySheets = sheetsResponse.value.filter(sheet => {
    const sheetName = sheet.name || '';
    // Regex casa com: "MES ANO" onde mês é um mês em português e ano tem 4 dígitos
    const regex = /^(JANEIRO|FEVEREIRO|MARÇO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)\s+\d{4}$/i;
    return regex.test(sheetName);
  });

  console.log(`🔍 Abas mensais detectadas para processamento (${monthlySheets.length}):`);
  monthlySheets.forEach(s => console.log(`   - ${s.name}`));

  if (monthlySheets.length === 0) {
    console.warn('⚠️ Nenhuma aba correspondente ao padrão de meses/anos foi identificada. Encerrando worker.');
    return;
  }

  let totalProcessed = 0;
  let totalSaved = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  // 3. Iterar por cada aba mensal de forma dinâmica
  for (const sheet of monthlySheets) {
    console.log(`\n======================================================`);
    console.log(`📊 Processando Aba: ${sheet.name.toUpperCase()}`);
    console.log(`======================================================`);

    const dataEndpoint = `https://graph.microsoft.com/v1.0/users/${userId}/drive/root:${filePath}:/workbook/worksheets/${encodeURIComponent(sheet.name)}/usedRange`;
    
    let rangeData;
    try {
      rangeData = await fetchWithRetry(dataEndpoint, { headers });
    } catch (err) {
      console.error(`❌ Erro ao baixar dados da aba ${sheet.name}: ${err.message}. Pulando aba.`);
      totalErrors++;
      continue;
    }

    if (!rangeData || !rangeData.values || rangeData.values.length <= 1) {
      console.log(`⚠️ A aba ${sheet.name} está vazia ou não contém linhas de dados além do cabeçalho. Pulando.`);
      continue;
    }

    const rows = rangeData.values;
    const headerRow = rows[0];
    const indexMap = mapHeaderIndexes(headerRow);

    // Validação de colunas obrigatórias
    if (indexMap.telefone === -1) {
      console.error(`❌ Coluna 'Telefone' não foi identificada na aba ${sheet.name}. Abortando processamento da aba.`);
      totalErrors++;
      continue;
    }

    console.log(`📈 Mapeamento de Colunas Identificado na Aba:`);
    Object.entries(indexMap).forEach(([field, idx]) => {
      console.log(`   - ${field.padEnd(20)}: Coluna ${idx !== -1 ? idx : 'NÃO ENCONTRADA'}`);
    });

    // 4. Iterar pelas linhas de dados da aba
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      totalProcessed++;

      // Encapsular em try/catch para que falhas em células ou linhas corrompidas não abortem a sincronização de outras linhas
      try {
        const rawTelefone = indexMap.telefone !== -1 ? row[indexMap.telefone] : null;
        const telefoneClean = sanitizeTelefone(rawTelefone);

        if (!telefoneClean) {
          console.warn(`⚠️ Linha ${i + 1} pulada: Telefone inválido ou ausente ("${rawTelefone}").`);
          totalSkipped++;
          continue;
        }

        const rawData = indexMap.data !== -1 ? row[indexMap.data] : null;
        const parsedDate = parseDate(rawData, sheet.name);

        const rawNome = indexMap.nome_cliente !== -1 ? row[indexMap.nome_cliente] : null;
        const rawOrigem = indexMap.origem !== -1 ? row[indexMap.origem] : null;
        const rawPrimeiraMsg = indexMap.primeira_mensagem !== -1 ? row[indexMap.primeira_mensagem] : null;
        const rawServico = indexMap.tipo_servico !== -1 ? row[indexMap.tipo_servico] : null;
        const rawVeiculo = indexMap.veiculo !== -1 ? row[indexMap.veiculo] : null;
        const rawComercial = indexMap.comercial !== -1 ? row[indexMap.comercial] : null;
        const rawConversao = indexMap.conversao !== -1 ? row[indexMap.conversao] : null;
        const rawStatus = indexMap.status !== -1 ? row[indexMap.status] : null;
        const rawValor = indexMap.valor_faturado !== -1 ? row[indexMap.valor_faturado] : null;

        // Sanitização das colunas operacionais
        const leadData = {
          telefone: telefoneClean,
          data: parsedDate,
          nome_cliente: cleanOperationalMark(rawNome),
          origem: cleanOperationalMark(rawOrigem),
          primeira_mensagem: cleanOperationalMark(rawPrimeiraMsg),
          tipo_servico: cleanOperationalMark(rawServico),
          veiculo: cleanOperationalMark(rawVeiculo),
          comercial: cleanOperationalMark(rawComercial),
          conversao: cleanOperationalMark(rawConversao),
          status: cleanOperationalMark(rawStatus),
          valor_faturado: parseCurrency(rawValor)
        };

        // 5. Upsert Idempotente no PostgreSQL (Supabase)
        await prisma.leadSolution.upsert({
          where: { telefone: leadData.telefone },
          update: {
            data: leadData.data,
            nome_cliente: leadData.nome_cliente,
            origem: leadData.origem,
            primeira_mensagem: leadData.primeira_mensagem,
            tipo_servico: leadData.tipo_servico,
            veiculo: leadData.veiculo,
            comercial: leadData.comercial,
            conversao: leadData.conversao,
            status: leadData.status,
            valor_faturado: leadData.valor_faturado
          },
          create: {
            telefone: leadData.telefone,
            data: leadData.data,
            nome_cliente: leadData.nome_cliente,
            origem: leadData.origem,
            primeira_mensagem: leadData.primeira_mensagem,
            tipo_servico: leadData.tipo_servico,
            veiculo: leadData.veiculo,
            comercial: leadData.comercial,
            conversao: leadData.conversao,
            status: leadData.status,
            valor_faturado: leadData.valor_faturado
          }
        });

        totalSaved++;
      } catch (lineErr) {
        console.error(`❌ Erro ao sincronizar linha ${i + 1} da aba ${sheet.name}: ${lineErr.message}`);
        totalErrors++;
      }
    }
  }

  console.log(`\n======================================================`);
  console.log(`🏁 SINCRONIZAÇÃO COMPLETA`);
  console.log(`   Linhas Processadas : ${totalProcessed}`);
  console.log(`   Leads Sincronizados: ${totalSaved}`);
  console.log(`   Leads Ignorados    : ${totalSkipped}`);
  console.log(`   Erros de Execução  : ${totalErrors}`);
  console.log(`======================================================`);
}

// Executar
syncOneDriveCRM()
  .catch(e => {
    console.error('💥 Erro fatal no worker de sincronização do OneDrive:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('🔌 Prisma desconectado.');
  });
