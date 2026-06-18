const fs = require('fs');
const path = require('path');

// 1. CARREGAMENTO DE VARIÁVEIS DE AMBIENTE
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

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CLIENT_SLUG = 'solutionplace';

const rawLeads = [
  {
    data: '2026-06-01',
    nome: 'GERMÁRIO',
    telefone: '22998382864',
    origem: 'INSTAGRAM',
    mensagem: 'NÃO IDENTIFICADO',
    servico: 'X',
    veiculo: 'X',
    comercial: 'X',
    conversao: 'X',
    status: 'LEAD DESQUALIFICADO',
    valor: 0
  },
  {
    data: '2026-06-03',
    nome: 'CELESTE MARIA',
    telefone: '21993379224',
    origem: 'FACEBOOK',
    mensagem: 'PREÇO',
    servico: 'X',
    veiculo: 'X',
    comercial: 'X',
    conversao: 'X',
    status: 'NÃO RESPONDEU',
    valor: 0
  },
  {
    data: '2026-06-03',
    nome: 'ROBERTO AYLMER',
    telefone: '21996095031',
    origem: 'INSTAGRAM',
    mensagem: 'OI! GOSTARIA DE UM ORÇAMENTO DE BLINDAGEM (JÁ ENTROU EM CONTATO ANTES E NÃO FECHOU POR CONTA DO PRAZO DE ENTREGA)',
    servico: 'BLINDAGEM',
    veiculo: 'BYD SONG PLUS PREMIUM',
    comercial: 'RUTE',
    conversao: 'NEGATIVO',
    status: 'ORÇOU COM OUTRA BLINDADORA/ ACHOU NOSSO VALOR ALTO',
    valor: 0
  },
  {
    data: '2026-06-05',
    nome: 'LEONARDO',
    telefone: '21964683971',
    origem: 'FACEBOOK',
    mensagem: 'OI! GOSTARIA DE UM ORÇAMENTO DE BLINDAGEM',
    servico: 'BLINDAGEM',
    veiculo: 'BMW X4 2019',
    comercial: 'VALÉRIA',
    conversao: 'X',
    status: 'X',
    valor: 0
  },
  {
    data: '2026-06-05',
    nome: 'NÃO IDENTIFICADO (SITE)',
    telefone: '21999990001',
    origem: 'SITE',
    mensagem: 'ESTOU VINDO DO SITE E GOSTARIA DE MAIS INFORMAÇÕES',
    servico: 'BLINDAGEM',
    veiculo: 'JEEP COMMANDER  0KM',
    comercial: 'RAYANE',
    conversao: 'AGUARDANDO',
    status: 'AGUARDANDO RESPOSTA DO CLIENTE',
    valor: 0
  },
  {
    data: '2026-06-05',
    nome: 'ANDRÉ GOUVÊA',
    telefone: '21997250412',
    origem: 'SITE',
    mensagem: 'OLÁ! ESTOU VINDO DO SITE E GOSTARIA DE MAIS INFORMAÇÕES',
    servico: 'BLINDAGEM',
    veiculo: 'HRV ADVANCE 2025',
    comercial: 'RUTE',
    conversao: 'AGUARDANDO',
    status: 'ORÇAMENTO ENVIADO/ AGUARDANDO',
    valor: 0
  },
  {
    data: '2026-06-05',
    nome: 'CHICO ESTRELA',
    telefone: '7788416267',
    origem: 'INSTAGRAM',
    mensagem: 'OI! GOSTARIA DE UM ORÇAMENTO DE BLINDAGEM',
    servico: 'X',
    veiculo: 'X',
    comercial: 'X',
    conversao: 'X',
    status: 'X',
    valor: 0
  },
  {
    data: '2026-06-05',
    nome: 'ACÉLIO',
    telefone: '21999551923',
    origem: 'N IDENTIFICADO',
    mensagem: 'BOA TARDE. AGRADEÇO ME INFORMAR ORÇAMENTO',
    servico: 'BLINDAGEM',
    veiculo: 'HYUNDAI CRETA ULTIMATE',
    comercial: 'VALÉRIA',
    conversao: 'AGUARDANDO',
    status: 'ORÇAMENTO ENVIADO',
    valor: 0
  },
  {
    data: '2026-06-06',
    nome: 'MARCIO MARTINS',
    telefone: '15991199653',
    origem: 'SITE',
    mensagem: 'OLÁ! ESTOU VINDO DO SITE E GOSTARIA DE MAIS INFORMAÇÕES',
    servico: 'BLINDAGEM',
    veiculo: 'BMW X7(NEGOCIANDO A COMPRA DO VEÍCULO COM OUTRA PESSOA)',
    comercial: 'VALÉRIA',
    conversao: 'NEGATIVO',
    status: 'ESTAVA NEGOCIANDO A COMPRA DE UM CARRO NO RJ , PORÉM NÃO EFETIVOU',
    valor: 0
  },
  {
    data: '2026-06-07',
    nome: 'GORETE',
    telefone: '21976249737',
    origem: 'INSTAGRAM',
    mensagem: 'OI! GOSTARIA DE UM ORÇAMENTO DE BLINDAGEM',
    servico: 'X',
    veiculo: 'X',
    comercial: 'X',
    conversao: 'X',
    status: 'NÃO RESPONDEU',
    valor: 0
  },
  {
    data: '2026-06-08',
    nome: 'LEONARDO',
    telefone: '21992924665',
    origem: 'SITE',
    mensagem: 'OLÁ! ESTOU VINDO DO SITE E GOSTARIA DE MAIS INFORMAÇÕES',
    servico: 'BLINDAGEM',
    veiculo: 'LEXUS RX 500H',
    comercial: 'RUTE',
    conversao: 'POSITIVO',
    status: 'NEGÓCIO FECHADO',
    valor: 136000.00
  },
  {
    data: '2026-06-08',
    nome: 'CAROLINE KETHLEN',
    telefone: '21974767319',
    origem: 'SITE',
    mensagem: 'OLÁ! ESTOU VINDO DO SITE E GOSTARIA DE MAIS INFORMAÇÕES',
    servico: 'BLINDAGEM',
    veiculo: 'HAVAL H9',
    comercial: 'VALÉRIA',
    conversao: 'AGUARDANDO',
    status: 'PEDIU ORÇAMENTO PORÉM AINDA NÃO COMPROU O CARRO',
    valor: 0
  },
  {
    data: '2026-06-09',
    nome: 'NUBE ESTAGIÁRIOS',
    telefone: '11943357272',
    origem: 'N IDENTIFICADO',
    mensagem: 'GOSTARIA DE FALAR COM RESPONSÁVEL PELAS CONTRATAÇÕES',
    servico: 'CONTATO RH',
    veiculo: 'X',
    comercial: 'X',
    conversao: 'X',
    status: 'LEAD DESQUALIFICADO',
    valor: 0
  },
  {
    data: '2026-06-11',
    nome: 'ROBSON BARRETO',
    telefone: '22999822759',
    origem: 'INSTAGRAM',
    mensagem: 'OLÁ PRECISO DE ASSISTÊNCIA TÉCNICA PARA MEU BLINDADO',
    servico: 'ASSISTÊNCIA',
    veiculo: 'NÃO IDENTIFICADO',
    comercial: 'X',
    conversao: 'X',
    status: 'NÃO RESPONDEU',
    valor: 0
  },
  {
    data: '2026-06-11',
    nome: 'JÚLIO CÉSAR',
    telefone: '21990011868',
    origem: 'INSTAGRAM',
    mensagem: 'NÃO IDENTIFICADO',
    servico: 'X',
    veiculo: 'X',
    comercial: 'X',
    conversao: 'X',
    status: 'LEAD DESQUALIFICADO',
    valor: 0
  },
  {
    data: '2026-06-12',
    nome: 'RUBENS',
    telefone: '21999864105',
    origem: 'FACEBOOK',
    mensagem: 'BLINDAGEM DE UM RENEGADE, QUAL VIDRO? GARANTIA? ...',
    servico: 'BLINDAGEM',
    veiculo: 'RENEGADE S 4X4 0 OU 2024',
    comercial: 'RUTE',
    conversao: 'AGUARDANDO',
    status: 'NÃO RESPONDEU',
    valor: 0
  },
  {
    data: '2026-06-13',
    nome: 'RICARDO CARVALHO',
    telefone: '21995463035',
    origem: 'N IDENTIFICADO',
    mensagem: 'BOA NOITE, GOSTARIA DE ORÇAMENTO E PRAZO PARA BLINDAR..',
    servico: 'BLINDAGEM',
    veiculo: 'VOLVO EX30',
    comercial: 'RAYANE',
    conversao: 'AGUARDANDO',
    status: 'ENCAMINHADO AO COMERCIAL',
    valor: 0
  },
  {
    data: '2026-06-15',
    nome: 'NÃO IDENTIFICADO',
    telefone: '21970183776',
    origem: 'SITE',
    mensagem: 'OLÁ! ESTOU VINDO DO SITE E GOSTARIA DE MAIS INFORMAÇÕES',
    servico: 'X',
    veiculo: 'X',
    comercial: 'X',
    conversao: 'X',
    status: 'NÃO RESPONDEU',
    valor: 0
  },
  {
    data: '2026-06-15',
    nome: 'JOÃO GUSTAVO',
    telefone: '21975399889',
    origem: 'INSTAGRAM',
    mensagem: 'BOM DIA, GOSTARIA DE ORÇAMENTO PARA BLINDAR UM JETTOUR',
    servico: 'BLINDAGEM',
    veiculo: 'JETOUR T2',
    comercial: 'RUTE',
    conversao: 'NEGATIVO',
    status: 'NÃO FECHOU, ORÇAMENTO FICOU ACIMA DO ESPERADO',
    valor: 0
  },
  {
    data: '2026-06-15',
    nome: 'SERGIO',
    telefone: '21998807878',
    origem: 'INSTAGRAM',
    mensagem: 'VOCÊS BLINDAM GEELY EX5 COM TETO?',
    servico: 'BLINDAGEM',
    veiculo: 'GEELY EX5',
    comercial: 'VALÉRIA',
    conversao: 'AGUARDANDO',
    status: 'ENCAMINHADO AO COMERCIAL',
    valor: 0
  },
  {
    data: '2026-06-15',
    nome: 'VICTOR',
    telefone: '21997604598',
    origem: 'SITE',
    mensagem: 'OLÁ! ESTOU VINDO DO SITE E GOSTARIA DE MAIS INFORMAÇÕES',
    servico: 'BLINDAGEM',
    veiculo: 'COROLLA CROSS GR',
    comercial: 'RAYANE',
    conversao: 'AGUARDANDO',
    status: 'ENCAMINHADO AO COMERCIAL',
    valor: 0
  },
  {
    data: '2026-06-15',
    nome: 'JOÃO VICENTE',
    telefone: '21996101404',
    origem: 'SITE',
    mensagem: 'OLÁ! ESTOU VINDO DO SITE E GOSTARIA DE MAIS INFORMAÇÕES',
    servico: 'N IDENTIFICADO',
    veiculo: 'X',
    comercial: 'X',
    conversao: 'X',
    status: 'X',
    valor: 0
  },
  {
    data: '2026-06-16',
    nome: 'LUDIMILA PONTES',
    telefone: '21991129373',
    origem: 'INSTAGRAM',
    mensagem: 'OI! GOSTARIA DE UM ORÇAMENTO DE BLINDAGEM',
    servico: 'MARKETING',
    veiculo: 'X',
    comercial: 'X',
    conversao: 'X',
    status: 'CONTATO DA EVE ENCAMINHADO',
    valor: 0
  },
  {
    data: '2026-06-16',
    nome: 'MARCIODI PIERO',
    telefone: '21999664974',
    origem: 'INSTAGRAM',
    mensagem: 'BOA TARDE. QUAL O VALOR DO CARRO ?',
    servico: 'COMPRA',
    veiculo: 'BMW X7',
    comercial: 'X',
    conversao: 'X',
    status: 'CARRO JÁ VENDIDO',
    valor: 0
  }
];

function mapCrmStatus(sheetStatus) {
  if (!sheetStatus) return 'NOVO';
  const s = sheetStatus.toUpperCase().trim();
  if (s.includes('NEGÓCIO FECHADO') || s.includes('FECHADO')) return 'FECHADO';
  if (s.includes('DESQUALIFICADO') || s.includes('NÃO RESPONDEU') || s.includes('ACHOU NOSSO VALOR ALTO') || s.includes('VENDIDO') || s.includes('NÃO EFETIVOU')) return 'PERDIDO';
  if (s.includes('AGUARDANDO') || s.includes('ORÇAMENTO ENVIADO') || s.includes('COMERCIAL')) return 'NEGOCIACAO';
  if (s.includes('ENCAMINHADO') || s.includes('CONTATO')) return 'CONTATO';
  return 'NOVO';
}

function cleanOperationalMark(val) {
  if (val === null || val === undefined) return null;
  const valStr = String(val).trim();
  if (!valStr || ['x', 'x', '-', 'nulo', 'null', ''].includes(valStr.toLowerCase())) {
    return null;
  }
  return valStr;
}

async function runSeeding() {
  console.log('📡 Buscando cliente no banco de dados...');
  const cliente = await prisma.cliente.findUnique({ where: { slug: CLIENT_SLUG } });
  if (!cliente) {
    console.error(`❌ Cliente com slug "${CLIENT_SLUG}" não encontrado.`);
    process.exit(1);
  }
  console.log(`✅ Cliente encontrado: "${cliente.nome}" (ID: ${cliente.id})`);

  let countLeadSolution = 0;
  let countLeadCRM = 0;

  for (const item of rawLeads) {
    const dataObj = new Date(item.data + 'T03:00:00.000Z'); // Brasília timezone offset adjust for UTC insertion
    
    // --- 1. POPULAR TABELA LeadSolution (ONDrive Staging) ---
    try {
      await prisma.leadSolution.upsert({
        where: { telefone: item.telefone },
        update: {
          data: dataObj,
          nome_cliente: cleanOperationalMark(item.nome),
          origem: cleanOperationalMark(item.origem),
          primeira_mensagem: cleanOperationalMark(item.mensagem),
          tipo_servico: cleanOperationalMark(item.servico),
          veiculo: cleanOperationalMark(item.veiculo),
          comercial: cleanOperationalMark(item.comercial),
          conversao: cleanOperationalMark(item.conversao),
          status: cleanOperationalMark(item.status),
          valor_faturado: item.valor
        },
        create: {
          telefone: item.telefone,
          data: dataObj,
          nome_cliente: cleanOperationalMark(item.nome),
          origem: cleanOperationalMark(item.origem),
          primeira_mensagem: cleanOperationalMark(item.mensagem),
          tipo_servico: cleanOperationalMark(item.servico),
          veiculo: cleanOperationalMark(item.veiculo),
          comercial: cleanOperationalMark(item.comercial),
          conversao: cleanOperationalMark(item.conversao),
          status: cleanOperationalMark(item.status),
          valor_faturado: item.valor
        }
      });
      countLeadSolution++;
    } catch (e) {
      console.error(`❌ Erro no upsert de LeadSolution para o telefone ${item.telefone}:`, e.message);
    }

    // --- 2. POPULAR TABELA Lead (CRM UI) ---
    try {
      // Procurar se já existe o lead correspondente a esse contato na tabela Lead
      const existingLead = await prisma.lead.findFirst({
        where: {
          cliente_id: cliente.id,
          contato: item.telefone
        }
      });

      const mappedStatus = mapCrmStatus(item.status);
      let dbLead;

      if (existingLead) {
        dbLead = await prisma.lead.update({
          where: { id: existingLead.id },
          data: {
            nome: item.nome,
            status: mappedStatus,
            valor: item.valor,
            origem: item.origem,
            data: dataObj
          }
        });
      } else {
        dbLead = await prisma.lead.create({
          data: {
            cliente_id: cliente.id,
            nome: item.nome,
            contato: item.telefone,
            status: mappedStatus,
            valor: item.valor,
            origem: item.origem,
            data: dataObj
          }
        });
      }
      countLeadCRM++;

      // Criar a nota com detalhes adicionais estruturados se ela ainda não existir
      const existingNote = await prisma.nota.findFirst({
        where: {
          lead_id: dbLead.id,
          texto: { startsWith: '[Detalhes Offline]' }
        }
      });

      const noteText = `[Detalhes Offline]
• Serviço: ${item.servico}
• Veículo: ${item.veiculo}
• Vendedor: ${item.comercial}
• 1ª Mensagem: ${item.mensagem}
• Conversão: ${item.conversao}
• Status Original: ${item.status}
• Valor Faturado: R$ ${item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

      if (existingNote) {
        await prisma.nota.update({
          where: { id: existingNote.id },
          data: { texto: noteText }
        });
      } else {
        await prisma.nota.create({
          data: {
            lead_id: dbLead.id,
            texto: noteText,
            autor: 'OneDrive Sync (Local Seeder)'
          }
        });
      }

    } catch (e) {
      console.error(`❌ Erro ao processar Lead CRM para ${item.nome}:`, e.message);
    }
  }

  console.log(`\n======================================================`);
  console.log(`🏁 POPULAÇÃO ANALÓGICA CONCLUÍDA!`);
  console.log(`   Leads inseridos na Staging (LeadSolution): ${countLeadSolution}`);
  console.log(`   Leads inseridos no CRM (Lead)            : ${countLeadCRM}`);
  console.log(`======================================================`);
}

runSeeding()
  .catch(e => {
    console.error('💥 Erro crítico no script de população analógica:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('🔌 Conexão com o Prisma encerrada.');
  });
