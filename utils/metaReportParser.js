/**
 * Utilitário de análise inteligente para relatórios exportados do Gerenciador de Anúncios da Meta.
 * Suporta separadores por vírgula (,), ponto-e-vírgula (;) ou tabulações (\t).
 * Detecta cabeçalhos em português e inglês.
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

  const findIndex = (possibleNames) => {
    return headers.findIndex(h => possibleNames.some(p => h.includes(p)));
  };

  const idxCampaignName = findIndex(['nome da campanha', 'campaign name', 'campanha']);
  const idxDate = findIndex(['dia', 'data', 'day', 'reporting starts', 'inicio do relatorio']);
  const idxSpend = findIndex(['valor usado', 'amount spent', 'gasto', 'custo', 'investimento']);
  const idxImpressions = findIndex(['impressoes', 'impressions']);
  const idxReach = findIndex(['alcance', 'reach']);
  const idxClicks = findIndex(['cliques (todos)', 'clicks (all)', 'cliques']);
  const idxLinkClicks = findIndex(['cliques no link', 'inline link clicks', 'link clicks']);
  const idxVisits = findIndex(['visitas ao perfil', 'instagram profile visits', 'visitas ao perfil do instagram', 'profile visits']);
  const idxMessagingStarted = findIndex(['conversas por mensagem iniciadas', 'messaging conversations started', 'conversas iniciadas']);
  const idxLeads = findIndex(['cadastros', 'leads', 'resultados', 'results']);

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

    const spend = idxSpend !== -1 ? parseNumberBR(cols[idxSpend]) : 0;
    const impressions = idxImpressions !== -1 ? Math.round(parseNumberBR(cols[idxImpressions])) : 0;
    const reach = idxReach !== -1 ? Math.round(parseNumberBR(cols[idxReach])) : 0;
    const clicks = idxClicks !== -1 ? Math.round(parseNumberBR(cols[idxClicks])) : 0;
    const linkClicks = idxLinkClicks !== -1 ? Math.round(parseNumberBR(cols[idxLinkClicks])) : 0;
    const profileVisits = idxVisits !== -1 ? Math.round(parseNumberBR(cols[idxVisits])) : 0;

    let leads = 0;
    if (idxMessagingStarted !== -1) {
      leads = Math.round(parseNumberBR(cols[idxMessagingStarted]));
    } else if (idxLeads !== -1) {
      leads = Math.round(parseNumberBR(cols[idxLeads]));
    }

    const finalVisits = profileVisits > 0 ? profileVisits : 0;

    totalSpend += spend;
    totalImpressions += impressions;
    totalReach += reach;
    totalClicks += clicks;
    totalLinkClicks += linkClicks;
    totalVisits += finalVisits;
    totalLeads += leads;

    rows.push({
      campaignName,
      date: parsedDate,
      spend,
      impressions,
      reach,
      clicks: clicks > 0 ? clicks : linkClicks,
      linkClicks,
      profileVisits: finalVisits,
      leads
    });
  }

  return {
    rows,
    summary: {
      totalRows: rows.length,
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
