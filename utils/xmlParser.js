/**
 * Utility to parse XML, CSV, TSV or HTML Table spreadsheet content
 * into a standardized array of lead objects for CRM import,
 * with strict 11-column canonical mapping matching Solution Place standards.
 */

function parseBrazilianDateStr(dateInput) {
  if (!dateInput) return null;
  let str = String(dateInput).trim();
  if (str.toUpperCase() === 'DATA') return null;

  // Normalizar múltiplas barras consecutivas (ex: "21//08/2026" -> "21/08/2026")
  str = str.replace(/\/+/g, '/').replace(/-+/g, '-');

  // 1. Formato DD/MM/YYYY ou DD-MM-YYYY
  const brMatch = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})/);
  if (brMatch) {
    let [, day, month, year] = brMatch;
    if (year.length === 2) year = '20' + year;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // 2. Formato YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})/);
  if (isoMatch) {
    let [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return str;
}

function isDatePattern(str) {
  if (!str) return false;
  const s = String(str).trim().replace(/\/+/g, '/');
  if (s.toUpperCase() === 'DATA') return true;
  return /^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})/.test(s) || /^\d{4}[\/\.-](\d{1,2})[\/\.-](\d{1,2})/.test(s);
}

function isPhonePattern(str) {
  if (!str) return false;
  const s = String(str).trim();
  if (isDatePattern(s)) return false;
  const digits = s.replace(/\D/g, '');
  if (digits.length === 8 && (digits.startsWith('19') || digits.startsWith('20'))) return false;
  return digits.length >= 8 && digits.length <= 13;
}

const KNOWN_SERVICES = [
  'BLINDAGEM', 'PRONTA ENTREGA', 'PRONTA_ENTREGA', 'ASSISTÊNCIA', 'ASSISTENCIA',
  'MANUTENÇÃO', 'REVISÃO', 'DOC. BLINDAGEM', 'DOC BLINDAGEM', 'DOCUMENTAÇÃO', 'PREÇO'
];

const KNOWN_ORIGINS = [
  'INSTAGRAM', 'FACEBOOK', 'SITE', 'WHATSAPP', 'GOOGLE', 'INDICAÇÃO', 'INDICACAO', 'N IDENTIFICADO'
];

const KNOWN_VENDEDORES = [
  'RUTE', 'VALÉRIA', 'VALERIA', 'RAYANE', 'DANIELLY', 'VIVIANE'
];

const KNOWN_VEHICLES = [
  'BMW', 'BYD', 'SONG', 'ORA', 'JEEP', 'COMMANDER', 'COMPASS', 'RENEGADE', 'COROLLA', 'SW4', 
  'HILUX', 'AMAROK', 'PORSCHE', 'AUDI', 'VOLVO', 'LAND ROVER', 'DEFENDER', 'DISCOVERY', 'RAM', 
  'HAVAL', 'CHERY', 'TIGGO', 'TAOS', 'NIVUS', 'FASTBACK', 'PULSE', 'CIVIC', 'TRACKER', 'CRETA', 
  'GEELY', 'JAECOO', 'MUSTANG', 'CAMARO', 'TORO', 'RANGER', 'X1', 'X3', 'X4', 'X5', 'X6', 'X7',
  'CAYENNE', 'MACAN', 'GLA', 'GLC', 'GLE', 'XC60', 'XC90', 'EVOQUE', 'RAPTOR', 'SEALION', 'DOLPHIN', 'SAVEIRO'
];

function cleanOperationalMark(val) {
  if (val === null || val === undefined) return null;
  const valStr = String(val).trim();
  if (!valStr || ['x', '-', 'nulo', 'null', ''].includes(valStr.toLowerCase())) {
    return null;
  }
  return valStr;
}

/**
 * Converte valor de moeda em float (suporta R$ 82.000,00, 3600.00, etc.)
 */
function parseCurrency(val) {
  if (val === undefined || val === null || val === '') return 0;
  const str = String(val).trim();
  if (str === '-' || str === '0' || str.toLowerCase() === 'x') return 0;
  
  // Limpa R$, espaços e quebras
  const cleaned = str
    .replace(/R\$\s*/gi, '')
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Mapeia o status textual operacional e a conversão para a etapa correspondente do funil CRM
 */
export function mapCrmStatus(conversao, statusDetalhe, valor) {
  const conv = String(conversao || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const det = String(statusDetalhe || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const valNum = Number(valor || 0);

  // 1. FECHADO: se foi marcado como POSITIVO, ou se há faturamento confirmado, ou texto explícito de fechamento
  if (
    conv.includes('POSITIV') ||
    valNum > 0 ||
    det.includes('NEGOCIO FECHADO') ||
    det.includes('FECHOU CONOSCO') ||
    det.includes('FECHADO') ||
    det.includes('VENDIDO') ||
    det.includes('CONCLU')
  ) {
    return 'FECHADO';
  }

  // 2. PERDIDO: desqualificado, sem resposta ou fechou com concorrente
  if (
    conv.includes('DESQUALIFICAD') ||
    conv.includes('NEGATIV') ||
    det.includes('NAO RESPONDEU') ||
    det.includes('NAO RESPONDE') ||
    det.includes('SEM RESPOSTA') ||
    det.includes('DESQUALIFICAD') ||
    det.includes('ENTROU ERRADO') ||
    det.includes('OUTRA BLINDADORA') ||
    det.includes('VALOR ALTO') ||
    det.includes('ACHOU ALTO') ||
    det.includes('CANCEL') ||
    det.includes('DESIST') ||
    det.includes('NAO EVOLUIU') ||
    det.includes('NAO BLINDAMOS') ||
    det.includes('NAO ESTA MAIS NA SOLUTION') ||
    det.includes('MANDOU ERRADO')
  ) {
    return 'PERDIDO';
  }

  // 3. NEGOCIACAO: proposta enviada, em análise, aguardando resposta
  if (
    conv.includes('AGUARDAND') ||
    det.includes('ORCAMENT') ||
    det.includes('ANALISAND') ||
    det.includes('AVALIAND') ||
    det.includes('AGUARDAND') ||
    det.includes('PROPOST') ||
    det.includes('NEGOCIA')
  ) {
    return 'NEGOCIACAO';
  }

  // 4. CONTATO: encaminhado a vendedor ou assistência inicial
  if (
    det.includes('ENCAMINHAD') ||
    det.includes('COMERCIAL') ||
    det.includes('ASSISTENCIA') ||
    det.includes('CONTAT') ||
    det.includes('ATENDIM')
  ) {
    return 'CONTATO';
  }

  return 'NOVO';
}

/**
 * Lê o atributo de índice da célula de forma resiliente a namespaces XML
 */
function getCellIndex(cell) {
  if (!cell || !cell.attributes) return null;
  for (let i = 0; i < cell.attributes.length; i++) {
    const attr = cell.attributes[i];
    const name = attr.name.toLowerCase();
    const local = (attr.localName || '').toLowerCase();
    if (name.endsWith('index') || local === 'index') {
      const parsed = parseInt(attr.value, 10);
      if (!isNaN(parsed)) return parsed - 1; // 0-based
    }
  }
  return null;
}

/**
 * Classificador e organizador inteligente de Lead de acordo com o padrão Solution Place.
 */
export function smartClassifyLead(rawItem) {
  if (!rawItem || typeof rawItem !== 'object') return rawItem;

  const getProp = (...keys) => {
    for (const k of keys) {
      if (rawItem[k] !== undefined && rawItem[k] !== null && String(rawItem[k]).trim() !== '') {
        return cleanOperationalMark(rawItem[k]);
      }
    }
    return null;
  };

  let rawData = getProp('data', 'date', 'dia', 'data de entrada', 'data cadastro', 'col_0');
  let rawNome = getProp('nome', 'nome_cliente', 'nome do cliente', 'cliente', 'lead', 'contatante', 'solicitante', 'col_1');
  let rawContato = getProp('contato', 'telefone', 'tel', 'celular', 'phone', 'whatsapp', 'fone', 'mobile', 'col_2');
  let rawOrigem = getProp('origem', 'fonte', 'canal', 'midia', 'veio de onde', 'veio', 'veio insta/site', 'veiode', 'col_3');
  let rawMsg = getProp('primeira_mensagem', 'primeira mensagem', 'mensagem', 'msg', 'obs', 'observacao', 'nota', 'detalhes', 'col_4');
  let rawServico = getProp('tipo_servico', 'tipo de serviço', 'tipo servico', 'serviço', 'servico', 'interesse', 'col_5');
  let rawVeiculo = getProp('veiculo', 'veículo', 'carro', 'modelo', 'veiculos', 'automovel', 'col_6');
  let rawComercial = getProp('comercial', 'vendedor', 'atendente', 'consultor', 'responsavel', 'col_7');
  let rawConversao = getProp('conversao', 'conversão', 'col_8');
  let rawStatusDetalhe = getProp('status_detalhe', 'status', 'situação', 'situacao', 'detalhamento', 'observacoes', 'col_9');
  let rawValor = getProp('valor', 'valorfaturado', 'valor faturado', 'faturado', 'faturamento', 'preco', 'preço', 'orçamento', 'orcamento', 'col_10');

  // 1. NORMALIZAÇÃO DE DATA
  if (rawData) {
    rawData = parseBrazilianDateStr(rawData);
  } else if (isDatePattern(rawNome)) {
    rawData = parseBrazilianDateStr(rawNome);
    rawNome = null;
  }

  // 2. NORMALIZAÇÃO DE TELEFONE
  if (rawContato) {
    rawContato = String(rawContato).replace(/\D/g, '');
  } else {
    for (const val of Object.values(rawItem)) {
      if (val && isPhonePattern(val)) {
        rawContato = String(val).replace(/\D/g, '');
        break;
      }
    }
  }

  // 3. PROTEÇÃO: SE UM VENDEDOR FOI COLOCADO EM VEÍCULO, MOVER PARA COMERCIAL
  if (rawVeiculo) {
    const vUpper = String(rawVeiculo).trim().toUpperCase();
    const vendedorEncontrado = KNOWN_VENDEDORES.find(v => v === vUpper || vUpper.includes(v));
    if (vendedorEncontrado) {
      if (!rawComercial || rawComercial === 'X') {
        rawComercial = vendedorEncontrado === 'VALERIA' ? 'VALÉRIA' : vendedorEncontrado;
      }
      rawVeiculo = null;
    }
  }

  // 4. AJUSTE DE CONVERSÃO E STATUS DETALHE
  let conversaoMacro = rawConversao;
  let statusDetalhe = rawStatusDetalhe;

  if (conversaoMacro && statusDetalhe) {
    const macroList = ['POSITIVO', 'NEGATIVO', 'AGUARDANDO', 'DESQUALIFICADO', 'X'];
    const s1 = String(conversaoMacro).trim().toUpperCase();
    const s2 = String(statusDetalhe).trim().toUpperCase();
    if (!macroList.includes(s1) && macroList.includes(s2)) {
      conversaoMacro = s2;
      statusDetalhe = s1;
    }
  } else if (!conversaoMacro && statusDetalhe) {
    const macroList = ['POSITIVO', 'NEGATIVO', 'AGUARDANDO', 'DESQUALIFICADO'];
    const s = String(statusDetalhe).trim().toUpperCase();
    if (macroList.includes(s)) {
      conversaoMacro = s;
      statusDetalhe = null;
    }
  }

  // 5. PARSE DE VALOR
  const parsedValor = parseCurrency(rawValor);

  // 6. CALCULAR FASE DO FUNIL CRM (FECHADO, PERDIDO, NEGOCIACAO, CONTATO, NOVO)
  const crmStatus = mapCrmStatus(conversaoMacro, statusDetalhe, parsedValor);

  // 7. NORMALIZAÇÃO DO NOME DO CLIENTE
  let finalNome = cleanOperationalMark(rawNome);
  if (!finalNome || isDatePattern(finalNome) || finalNome.toUpperCase() === 'DATA') {
    finalNome = rawContato ? `Lead ${rawContato}` : 'Lead Sem Nome';
  }

  // 8. NORMALIZAÇÃO DE COMERCIAL
  if (rawComercial) {
    const cUpper = String(rawComercial).trim().toUpperCase();
    if (cUpper === 'VALERIA') rawComercial = 'VALÉRIA';
  }

  return {
    data: rawData,
    nome: finalNome.trim(),
    contato: rawContato || null,
    origem: cleanOperationalMark(rawOrigem) || 'N IDENTIFICADO',
    primeira_mensagem: cleanOperationalMark(rawMsg) || null,
    tipo_servico: cleanOperationalMark(rawServico) || null,
    veiculo: cleanOperationalMark(rawVeiculo) || null,
    comercial: cleanOperationalMark(rawComercial) || null,
    conversao: cleanOperationalMark(conversaoMacro) || 'X',
    status_detalhe: cleanOperationalMark(statusDetalhe) || null,
    status: crmStatus,
    valor: parsedValor
  };
}

export function parseXmlLeads(fileText) {
  if (!fileText || typeof fileText !== 'string') {
    throw new Error('Conteúdo do arquivo em branco ou inválido.');
  }

  const trimmed = fileText.trim();

  // Se o conteúdo NÃO começar com '<', tenta parse como CSV / TSV
  if (!trimmed.startsWith('<')) {
    const csvLeads = parseCsvContent(trimmed);
    if (csvLeads.length > 0) return csvLeads;
  }

  // Parse como XML
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(trimmed, "text/xml");

    const parserError = xmlDoc.querySelector("parsererror");
    if (!parserError) {
      // 1. Excel XML (SpreadsheetML)
      const excelRows = xmlDoc.querySelectorAll("Row");
      if (excelRows.length > 0) {
        const leads = parseExcelXmlRows(excelRows);
        if (leads.length > 0) return leads;
      }

      // 2. Tabela HTML embarcada em XML
      const htmlTrs = xmlDoc.querySelectorAll("tr");
      if (htmlTrs.length > 0) {
        const leads = parseHtmlTableRows(Array.from(htmlTrs));
        if (leads.length > 0) return leads;
      }

      // 3. XML Genérico
      const recordNodes = Array.from(xmlDoc.querySelectorAll("lead, row, item, registro, cliente, lead_item"));
      if (recordNodes.length > 0) {
        const leads = parseGenericXmlNodes(recordNodes);
        if (leads.length > 0) return leads;
      }

      const root = xmlDoc.documentElement;
      if (root && root.children.length > 0) {
        const leads = parseGenericXmlNodes(Array.from(root.children));
        if (leads.length > 0) return leads;
      }
    }
  } catch (err) {
    console.warn('[XML Parser Error, tentando fallback CSV]', err.message);
  }

  try {
    const htmlDoc = new DOMParser().parseFromString(trimmed, "text/html");
    const rows = Array.from(htmlDoc.querySelectorAll("tr"));
    if (rows.length > 1) {
      const leads = parseHtmlTableRows(rows);
      if (leads.length > 0) return leads;
    }
  } catch (err) {
    // ignore
  }

  const csvLeads = parseCsvContent(trimmed);
  if (csvLeads.length > 0) return csvLeads;

  throw new Error("Nenhum registro legível foi identificado na estrutura do arquivo (XML/CSV).");
}

function isHeaderCellText(text) {
  if (!text) return false;
  const clean = text.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return (
    clean.includes('nome') || clean.includes('cliente') || clean.includes('contato') || 
    clean.includes('telefone') || clean.includes('status') || clean.includes('conversao') ||
    clean.includes('servico') || clean.includes('origem') || clean.includes('veiculo') ||
    clean.includes('comercial') || clean.includes('faturad') || clean.includes('data')
  );
}

function findHeaderRowIndex(rowsArray, extractCellTexts) {
  let bestIdx = 0;
  let maxScore = -1;

  for (let i = 0; i < Math.min(rowsArray.length, 10); i++) {
    const cellTexts = extractCellTexts(rowsArray[i]);
    let score = 0;
    cellTexts.forEach(txt => {
      if (isHeaderCellText(txt)) score++;
    });
    if (score > maxScore) {
      maxScore = score;
      bestIdx = i;
    }
  }
  return maxScore >= 2 ? bestIdx : 0;
}

export function parseExcelXmlRows(rowNodes) {
  const rowsArray = Array.from(rowNodes);
  if (rowsArray.length < 2) return [];

  // Localiza a linha de cabeçalho real
  const headerRowIdx = findHeaderRowIndex(rowsArray, (row) => {
    return Array.from(row.querySelectorAll("Cell")).map(c => {
      const dn = c.querySelector("Data");
      return (dn ? dn.textContent : c.textContent || '').trim();
    });
  });

  const headerRow = rowsArray[headerRowIdx];
  const headerCells = Array.from(headerRow.querySelectorAll("Cell"));
  const headers = {};
  
  let currentCol = 0;
  headerCells.forEach(cell => {
    const explicitIdx = getCellIndex(cell);
    if (explicitIdx !== null) {
      currentCol = explicitIdx;
    }
    const dataNode = cell.querySelector("Data");
    const text = (dataNode ? dataNode.textContent : cell.textContent || '').trim();
    headers[currentCol] = normalizeHeaderKey(text);
    currentCol++;
  });

  // Mapeamento canônico padrão se os cabeçalhos forem genéricos
  const canonicalMap = [
    'data', 'nome', 'contato', 'origem', 'primeira_mensagem',
    'tipo_servico', 'veiculo', 'comercial', 'conversao', 'status_detalhe', 'valor'
  ];

  const leads = [];
  for (let i = headerRowIdx + 1; i < rowsArray.length; i++) {
    const cells = Array.from(rowsArray[i].querySelectorAll("Cell"));
    if (cells.length === 0) continue;

    const item = {};
    let dataCol = 0;
    cells.forEach(cell => {
      const explicitIdx = getCellIndex(cell);
      if (explicitIdx !== null) {
        dataCol = explicitIdx;
      }
      const key = canonicalMap[dataCol] || `col_${dataCol}`;
      const dataNode = cell.querySelector("Data");
      const val = (dataNode ? dataNode.textContent : cell.textContent || '').trim();
      if (val) {
        item[key] = val;
      }
      dataCol++;
    });

    if (Object.keys(item).length > 0) {
      const classified = smartClassifyLead(item);
      const nomeUpper = (classified.nome || '').toUpperCase();
      if (
        nomeUpper &&
        !nomeUpper.includes('NOME DO CLIENTE') &&
        nomeUpper !== 'CLIENTE' &&
        nomeUpper !== 'DATA' &&
        (classified.contato || classified.veiculo || classified.tipo_servico || classified.data)
      ) {
        leads.push(classified);
      }
    }
  }
  return leads;
}

export function parseHtmlTableRows(trNodes) {
  if (trNodes.length < 2) return [];

  const headerRowIdx = findHeaderRowIndex(trNodes, (tr) => {
    return Array.from(tr.querySelectorAll("th, td")).map(c => c.textContent.trim());
  });

  const headerRow = trNodes[headerRowIdx];
  const headerCells = Array.from(headerRow.querySelectorAll("th, td"));
  const headers = headerCells.map(c => normalizeHeaderKey(c.textContent));

  const canonicalMap = [
    'data', 'nome', 'contato', 'origem', 'primeira_mensagem',
    'tipo_servico', 'veiculo', 'comercial', 'conversao', 'status_detalhe', 'valor'
  ];

  const leads = [];
  for (let i = headerRowIdx + 1; i < trNodes.length; i++) {
    const cells = Array.from(trNodes[i].querySelectorAll("td"));
    if (cells.length === 0) continue;

    const item = {};
    cells.forEach((cell, idx) => {
      const key = headers[idx] || canonicalMap[idx] || `col_${idx}`;
      item[key] = cell.textContent.trim();
    });

    if (Object.keys(item).length > 0) {
      const classified = smartClassifyLead(item);
      const nomeUpper = (classified.nome || '').toUpperCase();
      if (
        nomeUpper &&
        !nomeUpper.includes('NOME DO CLIENTE') &&
        (classified.contato || classified.veiculo || classified.tipo_servico || classified.data)
      ) {
        leads.push(classified);
      }
    }
  }
  return leads;
}

/**
 * Parser de arquivos CSV / TSV com mapeamento posicional canônico
 */
export function parseCsvContent(text) {
  if (!text || typeof text !== 'string') return [];
  const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (rawLines.length === 0) return [];

  // Detectar delimitador analisando as primeiras linhas
  const sample = rawLines.slice(0, 5).join('\n');
  const countTabs = (sample.match(/\t/g) || []).length;
  const countSemicolons = (sample.match(/;/g) || []).length;
  const countCommas = (sample.match(/,/g) || []).length;
  const countPipes = (sample.match(/\|/g) || []).length;

  let delimiter = '\t';
  if (countTabs > 0 && countTabs >= countSemicolons && countTabs >= countCommas) delimiter = '\t';
  else if (countSemicolons >= countCommas && countSemicolons > 0) delimiter = ';';
  else if (countCommas > 0) delimiter = ',';
  else if (countPipes > 0) delimiter = '|';

  const parseCsvLine = (line) => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === delimiter && !inQuotes) {
        values.push(current.replace(/^"|"$/g, '').trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.replace(/^"|"$/g, '').trim());
    return values;
  };

  const headerRowIdx = findHeaderRowIndex(rawLines, (l) => parseCsvLine(l));
  let headers = [];
  let startIndex = 0;

  if (headerRowIdx !== -1) {
    headers = parseCsvLine(rawLines[headerRowIdx]).map(normalizeHeaderKey);
    startIndex = headerRowIdx + 1;
  }

  const canonicalMap = [
    'data', 'nome', 'contato', 'origem', 'primeira_mensagem',
    'tipo_servico', 'veiculo', 'comercial', 'conversao', 'status_detalhe', 'valor'
  ];

  const leads = [];
  for (let i = startIndex; i < rawLines.length; i++) {
    const cols = parseCsvLine(rawLines[i]);
    if (cols.length === 0 || cols.every(c => !c)) continue;

    // Descartar fragmentos com menos de 3 colunas que não sejam leads legítimos
    if (cols.length < 3 && !isPhonePattern(cols[0]) && !isPhonePattern(cols[1])) {
      continue;
    }

    const item = {};

    // Se temos 9 a 12 colunas, aplicamos o mapeamento posicional canônico rígido
    if (cols.length >= 9) {
      cols.forEach((val, idx) => {
        const key = canonicalMap[idx] || `col_${idx}`;
        item[key] = val;
      });
    } else {
      cols.forEach((val, idx) => {
        const key = (headers && headers[idx]) || canonicalMap[idx] || `col_${idx}`;
        item[key] = val;
      });
    }

    const classified = smartClassifyLead(item);
    const nomeUpper = (classified.nome || '').toUpperCase();
    if (
      nomeUpper !== 'NOME DO CLIENTE' &&
      nomeUpper !== 'CLIENTE' &&
      nomeUpper !== 'DATA' &&
      (classified.contato || classified.veiculo || classified.tipo_servico || classified.data)
    ) {
      leads.push(classified);
    }
  }

  return leads;
}

export function parseGenericXmlNodes(nodes) {
  const leads = [];
  for (const node of nodes) {
    const item = {};
    for (const child of Array.from(node.children)) {
      const key = normalizeHeaderKey(child.tagName);
      item[key] = child.textContent.trim();
    }
    if (Object.keys(item).length > 0) {
      const classified = smartClassifyLead(item);
      const nomeUpper = (classified.nome || '').toUpperCase();
      if (
        nomeUpper &&
        !nomeUpper.includes('NOME DO CLIENTE') &&
        (classified.contato || classified.veiculo || classified.tipo_servico || classified.data)
      ) {
        leads.push(classified);
      }
    }
  }
  return leads;
}

export function normalizeHeaderKey(headerStr) {
  if (!headerStr) return '';
  const clean = headerStr.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
  
  if (clean.includes('nome') || clean.includes('cliente') || clean.includes('lead') || clean.includes('contatante') || clean.includes('solicitante')) return 'nome';
  if (clean.includes('contato') || clean.includes('telefone') || clean.includes('celular') || clean.includes('phone') || clean.includes('whatsapp') || clean.includes('fone') || clean.includes('tel')) return 'contato';
  if (clean.includes('conversao') || clean.includes('resultado')) return 'conversao';
  if (clean.includes('status') || clean.includes('situacao') || clean.includes('detalhamento') || clean.includes('observacoes')) return 'status_detalhe';
  if (clean.includes('faturad') || clean.includes('valor') || clean.includes('preco') || clean.includes('faturamento') || clean.includes('orcamento') || clean.includes('valortotal')) return 'valor';
  if (clean.includes('origem') || clean.includes('fonte') || clean.includes('canal') || clean.includes('midia') || clean.includes('veiode') || clean.includes('veio')) return 'origem';
  if (clean.includes('veiculo') || clean.includes('carro') || clean.includes('modelo') || clean.includes('auto') || clean.includes('veiculoprocurado') || clean.includes('veiculos')) return 'veiculo';
  if (clean.includes('servico') || clean.includes('tipo') || clean.includes('interess') || clean.includes('tiposervico')) return 'tipo_servico';
  if (clean.includes('comercial') || clean.includes('vendedor') || clean.includes('atendente') || clean.includes('consultor') || clean.includes('responsavel')) return 'comercial';
  if (clean.includes('mensagem') || clean.includes('nota') || clean.includes('obs') || clean.includes('descricao') || clean.includes('primeiramensagem') || clean.includes('observacao')) return 'primeira_mensagem';
  if (clean.includes('data') || clean.includes('date') || clean.includes('criado') || clean.includes('entrada') || clean.includes('cadastro') || clean.includes('hora') || clean.includes('dt')) return 'data';

  return clean;
}

export function cleanVehicleAndServiceText(str) {
  if (!str) return '';
  let text = String(str);

  text = text
    .replace(/INSPE[\uFFFD\?O]+(?:\s*BAL[\uFFFD\?S]+TICA)?/gi, 'INSPEÇÃO BALÍSTICA')
    .replace(/BAL[\uFFFD\?S]+TICA/gi, 'BALÍSTICA')
    .replace(/REVIS[\uFFFD\?O]+/gi, 'REVISÃO')
    .replace(/DELAMINAD[OA]|DELAMINA[\uFFFD\?O]+/gi, 'DELAMINAÇÃO')
    .replace(/OR[\uFFFD\?C]+AMENT[OA]/gi, 'ORÇAMENTO')
    .replace(/FUNILARI[A]+/gi, 'FUNILARIA')
    .replace(/ASSIST[\uFFFD\?N]+CIA/gi, 'ASSISTÊNCIA')
    .replace(/VE[\uFFFD\?I]+CUL[OA]/gi, 'VEÍCULO')
    .replace(/M[\uFFFD\?A]+RIO/gi, 'MÁRIO')
    .replace(/MOIS[\uFFFD\?E]+S/gi, 'MOISÉS')
    .replace(/MENDON[\uFFFD\?C]+A/gi, 'MENDONÇA')
    .replace(/GON[\uFFFD\?C]+ALVES/gi, 'GONÇALVES')
    .replace(/PRE[\uFFFD\?C]+O/gi, 'PREÇO')
    .replace(/EXPOSI[\uFFFD\?C]+[\uFFFD\?O]+/gi, 'EXPOSIÇÃO')
    .replace(/SERVI[\uFFFD\?C]+O/gi, 'SERVIÇO')
    .replace(/EST[\uFFFD\?A]+/gi, 'ESTÁ')
    .replace(/\uFFFD/g, '');

  return text.trim();
}

