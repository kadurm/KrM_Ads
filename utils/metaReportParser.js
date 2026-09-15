/**
 * Utilitário de análise inteligente para relatórios exportados do Gerenciador de Anúncios da Meta.
 * Suporta separadores por vírgula (,), ponto-e-vírgula (;) ou tabulações (\t).
 * Detecta cabeçalhos em português e inglês e blinda contra confusão entre 'Valor Usado' e 'Custo por Resultado'.
 */

export function parseNumberBR(val) {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let s = String(val).trim();
  if (!s || s === '-' || s === 'None' || s === 'null') return 0;
  s = s.replace(/R\$\s?|\$\s?/g, '').trim();
  
  if (s.includes('.') && s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export function parseDateString(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();

  const brMatch = s.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})/);
  if (brMatch) {
    let [, day, month, year] = brMatch;
    if (year.length === 2) year = '20' + year;
    const y = parseInt(year, 10);
    const m = String(parseInt(month, 10)).padStart(2, '0');
    const d = String(parseInt(day, 10)).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const isoMatch = s.match(/^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})/);
  if (isoMatch) {
    let [, year, month, day] = isoMatch;
    const y = parseInt(year, 10);
    const m = String(parseInt(month, 10)).padStart(2, '0');
    const d = String(parseInt(day, 10)).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const dObj = new Date(s);
  if (!isNaN(dObj.getTime())) {
    return dObj.toISOString().split('T')[0];
  }
  return null;
}

export function parseMetaReportCSV(rawContent) {
  if (!rawContent || typeof rawContent !== 'string') return { rows: [], summary: null };

  const lines = rawContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return { rows: [], summary: null };

  const firstLine = lines[0];
  let delimiter = ',';
  if (firstLine.includes('\t')) delimiter = '\t';
  else if (firstLine.includes(';') && (firstLine.split(';').length > firstLine.split(',').length)) delimiter = ';';

  const splitLine = (line) => {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === delimiter && !inQuotes) {
        result.push(cur.trim().replace(/^"|"$/g, '').trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim().replace(/^"|"$/g, '').trim());
    return result;
  };

  const headers = splitLine(firstLine).map(h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));

  const findExactOrIncludes = (exactList, includesList = []) => {
    let idx = headers.findIndex(h => exactList.some(e => h === e));
    if (idx !== -1) return idx;
    return headers.findIndex(h => includesList.some(p => h.includes(p)));
  };

  const idxCampaignName = findExactOrIncludes(['nome da campanha', 'campaign name'], ['campanha', 'campaign']);
  
  // Detecção de data (início do relatório ou dia)
  const idxDate = findExactOrIncludes(
    ['inicio dos relatorios', 'inicio do relatorio', 'reporting starts', 'data de inicio', 'dia', 'data', 'day', 'date'],
    ['inicio dos relatorio', 'inicio do relatorio', 'reporting start', 'dia', 'data']
  );

  // Detecção de término do relatório (período agregado)
  const idxEndDate = findExactOrIncludes(
    ['termino dos relatorios', 'termino do relatorio', 'reporting ends', 'data de termino', 'fim'],
    ['termino dos relatorio', 'termino do relatorio', 'reporting end', 'termino', 'fim']
  );

  // INVESTIMENTO / VALOR USADO:
  // Prioriza termos explícitos de total gasto e descarta categoricamente qualquer métrica de custo unitário (custo por...)
  let idxSpend = headers.findIndex(h => {
    return h.includes('valor usado') || 
           h.includes('amount spent') || 
           h.includes('total gasto') || 
           h.includes('gasto total') || 
           h.includes('investimento') ||
           h === 'spend';
  });

  if (idxSpend === -1) {
    idxSpend = headers.findIndex(h => 
      (h.includes('gasto') || h.includes('custo') || h.includes('cost')) &&
      !h.includes('por') && !h.includes('per') && !h.includes('/') && 
      !h.includes('resultado') && !h.includes('clique') && !h.includes('lead') && 
      !h.includes('mil') && !h.includes('cpm') && !h.includes('cpc') && !h.includes('cpl')
    );
  }

  const idxImpressions = findExactOrIncludes(['impressoes', 'impressions'], ['impresso']);
  const idxReach = findExactOrIncludes(['alcance', 'reach'], ['alcance', 'reach']);
  const idxClicks = findExactOrIncludes(['cliques (todos)', 'clicks (all)'], ['cliques (todos)', 'clicks (all)', 'cliques']);
  const idxLinkClicks = findExactOrIncludes(['cliques no link', 'inline link clicks', 'link clicks'], ['cliques no link', 'link clicks']);
  const idxVisits = findExactOrIncludes(['visitas ao perfil do instagram', 'visitas ao perfil', 'instagram profile visits', 'profile visits'], ['visitas ao perfil']);
  const idxMessagingStarted = findExactOrIncludes(['conversas por mensagem iniciadas', 'messaging conversations started', 'conversas iniciadas'], ['conversas por mensagem', 'conversas iniciadas']);
  const idxResults = findExactOrIncludes(['resultados', 'results'], ['resultado', 'result']);
  const idxResultType = headers.findIndex(h => h.includes('indicador de resultado') || h.includes('tipo de resultado') || h.includes('result type'));

  const rows = [];
  let totalSpend = 0;
  let totalImpressions = 0;
  let totalReach = 0;
  let totalClicks = 0;
  let totalLinkClicks = 0;
  let totalVisits = 0;
  let totalLeads = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    if (cols.length < 2) continue;

    const campaignName = idxCampaignName !== -1 ? cols[idxCampaignName] : 'Campanha';
    if (
      !campaignName ||
      campaignName.toLowerCase().includes('total') ||
      campaignName.toLowerCase().includes('resumo')
    ) {
      continue;
    }

    const rawDate = idxDate !== -1 ? cols[idxDate] : null;
    const parsedDate = parseDateString(rawDate);

    const rawEndDate = idxEndDate !== -1 ? cols[idxEndDate] : null;
    const parsedEndDate = parseDateString(rawEndDate);

    const spend = idxSpend !== -1 ? parseNumberBR(cols[idxSpend]) : 0;
    const impressions = idxImpressions !== -1 ? Math.round(parseNumberBR(cols[idxImpressions])) : 0;
    const reach = idxReach !== -1 ? Math.round(parseNumberBR(cols[idxReach])) : 0;
    const clicks = idxClicks !== -1 ? Math.round(parseNumberBR(cols[idxClicks])) : 0;
    const linkClicks = idxLinkClicks !== -1 ? Math.round(parseNumberBR(cols[idxLinkClicks])) : 0;
    
    // Visitas ao perfil
    let profileVisits = idxVisits !== -1 ? Math.round(parseNumberBR(cols[idxVisits])) : 0;
    
    // Leads / Conversas iniciadas
    let leads = idxMessagingStarted !== -1 ? Math.round(parseNumberBR(cols[idxMessagingStarted])) : 0;

    // Detecção dinâmica de Tipo de Resultado presente na linha (ex: exportação oficial do Gerenciador de Anúncios)
    const resultTypeStr = idxResultType !== -1 ? String(cols[idxResultType] || '').toLowerCase() : '';
    
    // Se visitas ao perfil for 0, checa se a linha tem indicação de visita ao perfil
    if (profileVisits === 0) {
      if (resultTypeStr.includes('visitas ao perfil') || cols.some(c => typeof c === 'string' && c.toLowerCase().includes('visitas ao perfil'))) {
        const num = idxResults !== -1 && parseNumberBR(cols[idxResults]) > 0 
          ? parseNumberBR(cols[idxResults]) 
          : (idxResultType !== -1 && cols[idxResultType + 1] ? parseNumberBR(cols[idxResultType + 1]) : 0);
        profileVisits = Math.round(num);
      }
    }

    // Se conversas/leads for 0, checa se a linha tem indicação de conversa ou cadastro
    if (leads === 0) {
      if (
        resultTypeStr.includes('conversa') || 
        resultTypeStr.includes('mensagem') || 
        resultTypeStr.includes('cadastro') || 
        resultTypeStr.includes('lead') ||
        cols.some(c => typeof c === 'string' && (c.toLowerCase().includes('conversas por mensagem') || c.toLowerCase().includes('conversas iniciadas')))
      ) {
        const num = idxResults !== -1 && parseNumberBR(cols[idxResults]) > 0 
          ? parseNumberBR(cols[idxResults]) 
          : (idxResultType !== -1 && cols[idxResultType + 1] ? parseNumberBR(cols[idxResultType + 1]) : 0);
        leads = Math.round(num);
      } else if (idxMessagingStarted === -1 && idxResults !== -1 && campaignName.toUpperCase().includes('MESSAGE')) {
        leads = Math.round(parseNumberBR(cols[idxResults]));
      }
    }

    totalSpend += spend;
    totalImpressions += impressions;
    totalReach += reach;
    totalClicks += clicks;
    totalLinkClicks += linkClicks;
    totalVisits += profileVisits;
    totalLeads += leads;

    rows.push({
      campaignName,
      date: parsedDate,
      endDate: parsedEndDate,
      spend,
      impressions,
      reach,
      clicks: clicks > 0 ? clicks : linkClicks,
      linkClicks,
      profileVisits,
      leads
    });
  }

  // Identificar período de cobertura
  const validDates = rows.map(r => r.date).filter(Boolean);
  const validEndDates = rows.map(r => r.endDate).filter(Boolean);
  const allDates = [...validDates, ...validEndDates].sort();
  const periodSince = allDates.length > 0 ? allDates[0] : null;
  const periodUntil = allDates.length > 0 ? allDates[allDates.length - 1] : null;

  // Se o início e fim forem diferentes ou se todas as linhas forem de um mesmo intervalo agregado
  const isPeriodConsolidated = Boolean(
    periodSince && periodUntil && (periodSince !== periodUntil || validEndDates.length > 0)
  );

  return {
    rows,
    summary: {
      totalRows: rows.length,
      periodSince,
      periodUntil,
      isPeriodConsolidated,
      totalSpend: parseFloat(totalSpend.toFixed(2)),
      totalImpressions,
      totalReach,
      totalClicks,
      totalLinkClicks,
      totalVisits,
      totalLeads
    }
  };
}
