import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

let campaignCalibrationMap = {};
try {
  const calPath = path.join(process.cwd(), 'utils', 'campaign_calibration.json');
  if (fs.existsSync(calPath)) {
    campaignCalibrationMap = JSON.parse(fs.readFileSync(calPath, 'utf8'));
  }
} catch (e) {
  console.error("Error loading campaign calibration config:", e);
}

function graphUrl(path, query) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });
  return url.toString();
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class TimeoutApproachingError extends Error {
  constructor(message, partialData = []) {
    super(message);
    this.name = 'TimeoutApproachingError';
    this.partialData = partialData;
  }
}

async function fetchMetaWithRetry(url, options = {}, startTime = null, timeBudgetMs = null) {
  let attempts = 0;
  const maxAttempts = 5;
  let delayTime = 1000;

  while (attempts < maxAttempts) {
    if (startTime && timeBudgetMs) {
      const elapsed = performance.now() - startTime;
      if (elapsed > timeBudgetMs - 2000) { // 2s buffer for DB saving
        throw new TimeoutApproachingError('Vercel timeout budget approaching');
      }
    }

    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const err = await res.json();
        const errCode = err.error?.code;
        
        // Rate limit: 4, 17, 32, 80000, 80007, or HTTP 429
        const isRateLimit = errCode === 4 || errCode === 17 || errCode === 32 || errCode === 80000 || errCode === 80007 || res.status === 429;
        
        if (isRateLimit && attempts < maxAttempts - 1) {
          attempts++;
          const jitter = Math.random() * 500;
          console.warn(`[Meta API Retry] Rate limit hit (code: ${errCode}). Retrying ${attempts}/${maxAttempts} in ${delayTime + jitter}ms...`);
          await delay(delayTime + jitter);
          delayTime *= 2;
          continue;
        }
        throw new Error(`Meta API Error: ${err.error?.message || res.statusText}`);
      }
      return await res.json();
    } catch (error) {
      if (error instanceof TimeoutApproachingError) throw error;
      if (attempts < maxAttempts - 1) {
        attempts++;
        console.warn(`[Meta API Retry] Request failed: ${error.message}. Retrying ${attempts}/${maxAttempts} in ${delayTime}ms...`);
        await delay(delayTime);
        delayTime *= 2;
        continue;
      }
      throw error;
    }
  }
}

async function fetchMetaPaginated(url, startTime = null, timeBudgetMs = null) {
  let allData = [];
  let currentUrl = url;

  while (currentUrl) {
    try {
      const json = await fetchMetaWithRetry(currentUrl, {}, startTime, timeBudgetMs);
      if (json.data) {
        allData = [...allData, ...json.data];
      }
      currentUrl = json.paging?.next || null;
    } catch (error) {
      if (error instanceof TimeoutApproachingError) {
        console.warn(`[Meta API Paginated] Timeout approaching! Returning partial data of ${allData.length} items.`);
        throw new TimeoutApproachingError('Timeout approaching during pagination', allData);
      }
      throw error;
    }
  }
  return allData;
}

/**
 * Robust fetch wrapper that preserves backward compatibility
 */
async function fetchMetaInsights(url) {
  return fetchMetaPaginated(url, null, null);
}

function getLocalDateString(date, timezone) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function getLocalDateNDaysAgo(timezone, daysAgo) {
  const d = new Date();
  const localDateStr = getLocalDateString(d, timezone);
  const [year, month, day] = localDateStr.split('-').map(Number);
  
  const localDate = new Date(year, month - 1, day);
  localDate.setDate(localDate.getDate() - daysAgo);
  
  const y = localDate.getFullYear();
  const m = String(localDate.getMonth() + 1).padStart(2, '0');
  const dayStr = String(localDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${dayStr}`;
}

async function getAccountTimezone(accountId, accessToken) {
  try {
    const res = await fetch(graphUrl(accountId, {
      access_token: accessToken,
      fields: 'timezone_name'
    }));
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || res.statusText);
    }
    const json = await res.json();
    return json.timezone_name || 'America/Sao_Paulo';
  } catch (error) {
    console.error(`[Meta API Timezone] Failed to fetch timezone for account ${accountId}:`, error);
    return 'America/Sao_Paulo';
  }
}

async function batchProcess(items, limit, taskFn) {
  const results = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const batchResults = await Promise.all(batch.map(item => taskFn(item)));
    results.push(...batchResults);
  }
  return results;
}

function getMetric(actions, type, isValue = false) {
  if (!Array.isArray(actions)) return 0;
  const matches = actions.filter(a => a.action_type === type);
  if (matches.length === 0) return 0;
  return matches.reduce((acc, a) => acc + (isValue ? parseFloat(a.value || 0) : parseInt(a.value || 0, 10)), 0);
}

function getTrueLeads(actions, campaignName = '') {
  if (!Array.isArray(actions)) return 0;
  const msgReply = getMetric(actions, 'onsite_conversion.messaging_first_reply');
  const msgStarted = getMetric(actions, 'onsite_conversion.messaging_conversation_started_7d');
  const standardLead = getMetric(actions, 'lead');
  const leadGen = getMetric(actions, 'onsite_conversion.lead_grouped');
  const fbContact = getMetric(actions, 'contact');
  
  const name = String(campaignName || '').toLowerCase();
  if (name.includes('message')) {
    return Math.max(msgReply, msgStarted);
  }
  
  return Math.max(msgReply, msgStarted) + Math.max(standardLead, leadGen) + fbContact;
}

function getSocialActions(actions) {
  if (!Array.isArray(actions)) return 0;
  return getMetric(actions, 'post_reaction') + 
         getMetric(actions, 'comment') + 
         getMetric(actions, 'onsite_conversion.post_save') + 
         getMetric(actions, 'post_save') + 
         getMetric(actions, 'onsite_conversion.post_share') + 
         getMetric(actions, 'share');
}

const getLeadLabel = (m) => {
  const obj = m.objetivo || '';
  if (m.isVisitas) return 'Visitas';
  if (m.conversas_leads > 0) return 'Leads';
  if (obj.includes('TRAFFIC')) return 'Cliques no Link';
  if (obj.includes('AWARENESS') || obj.includes('REACH')) return 'Alcance';
  if (obj.includes('ENGAGEMENT')) return 'Engajamentos';     
  if (obj.includes('SALES')) return 'Vendas';
  return 'Resultados';
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const clienteNome = searchParams.get('cliente');
    const since = searchParams.get('since');
    const until = searchParams.get('until');
    if (!clienteNome) return NextResponse.json({ success: false, error: "Cliente não especificado" }, { status: 400 });   

    const slug = clienteNome.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '');
    const shortName = clienteNome.normalize('NFD').replace(/[\u0300-\u036f]/g, "").split(' ')[0].replace(/[^a-zA-Z0-9]/g, '');
    
    const cliente = await prisma.cliente.findFirst({ 
      where: { 
        OR: [
          { nome: { equals: clienteNome, mode: 'insensitive' } },
          { slug: { equals: slug, mode: 'insensitive' } }
        ]
      } 
    });
    
    let metaAccountTotals = null;
    let metaCampReachMap = new Map();
    let metaAdReachMap = new Map();
    try {
      const ACCESS_TOKEN = process.env[`META_ACCESS_TOKEN_${slug.toUpperCase()}`] || 
                           process.env[`META_ACCESS_TOKEN_${slug}`] ||
                           process.env[`META_ACCESS_TOKEN_${shortName.toUpperCase()}`] ||
                           process.env[`META_ACCESS_TOKEN_${shortName}`] ||
                           process.env[`META_ACCESS_TOKEN_GLOBAL`] || 
                           cliente?.meta_access_token;

      const rawAccountId = process.env[`META_AD_ACCOUNT_ID_${slug.toUpperCase()}`] || 
                           process.env[`META_AD_ACCOUNT_ID_${slug}`] ||
                           process.env[`META_AD_ACCOUNT_ID_${shortName.toUpperCase()}`] ||
                           process.env[`META_AD_ACCOUNT_ID_${shortName}`] ||
                           cliente?.meta_ads_account_id;

      const AD_ACCOUNT_ID = rawAccountId?.startsWith('act_') ? rawAccountId : (rawAccountId ? `act_${rawAccountId}` : null);

      if (ACCESS_TOKEN && AD_ACCOUNT_ID) {
        const tr = JSON.stringify({ since, until });
        const [accData, campData, adData] = await Promise.all([
          fetchMetaInsights(graphUrl(`${AD_ACCOUNT_ID}/insights`, { access_token: ACCESS_TOKEN, time_range: tr, fields: 'reach,spend,impressions,actions,action_values', level: 'account' })),
          fetchMetaInsights(graphUrl(`${AD_ACCOUNT_ID}/insights`, { access_token: ACCESS_TOKEN, time_range: tr, fields: 'campaign_id,reach', level: 'campaign', limit: '100' })),
          fetchMetaInsights(graphUrl(`${AD_ACCOUNT_ID}/insights`, { access_token: ACCESS_TOKEN, time_range: tr, fields: 'ad_id,reach', level: 'ad', limit: '500' }))
        ]);
        if (accData && accData[0]) metaAccountTotals = accData[0];
        
        if (campData) {
          campData.forEach(c => metaCampReachMap.set(String(c.campaign_id), parseInt(c.reach) || 0));
        }

        if (adData) {
          adData.forEach(a => metaAdReachMap.set(String(a.ad_id), parseInt(a.reach) || 0));
        }
      }
    } catch (e) { console.error("Erro ao buscar totais reais na Meta:", e); }

    if (!cliente && !metaAccountTotals) return NextResponse.json({ success: true, metrics: [], criativos: [] });

    const lastMetric = await prisma.metricaCampanha.findFirst({
      where: { campanha: { cliente_id: cliente.id } },
      orderBy: { data: 'desc' }
    });
    const lastSyncDate = lastMetric ? lastMetric.data.toISOString().split('T')[0] : null;

    const dateUntil = until ? new Date(until + 'T23:59:59.999Z') : new Date();
    const dateSince = since ? new Date(since + 'T00:00:00.000Z') : new Date(new Date().setDate(dateUntil.getDate() - 30));     

    const campanhas = await prisma.campanha.findMany({       
      where: { cliente_id: cliente.id },
      include: { metricas: { where: { data: { gte: dateSince, lte: dateUntil } } } }
    });

    const metrics = campanhas.map(camp => {
      const total = camp.metricas.reduce((acc, m) => ({      
        impressoes: acc.impressoes + m.impressoes,
        alcance: Math.max(acc.alcance, m.alcance),
        cliques: acc.cliques + m.cliques,
        visitas_perfil: acc.visitas_perfil + m.visitas_perfil,
        seguidores: acc.seguidores + m.seguidores,
        conversas_leads: acc.conversas_leads + m.conversas_leads,
        valor_investido: acc.valor_investido + Number(m.valor_investido),
        compras: acc.compras + m.compras,
        valor_compras: acc.valor_compras + Number(m.valor_compras || 0) + Number(m.faturamento_manual || 0),
        reacoes_sociais: acc.reacoes_sociais + m.reacoes_sociais,
        engajamentoTotal: acc.engajamentoTotal + (m.cliques + m.visitas_perfil + m.seguidores + m.reacoes_sociais)
      }), { impressoes: 0, alcance: 0, cliques: 0, visitas_perfil: 0, seguidores: 0, conversas_leads: 0, valor_investido: 0, compras: 0, valor_compras: 0, engajamentoTotal: 0, reacoes_sociais: 0 });     

      if (metaCampReachMap.has(String(camp.meta_id))) {
        total.alcance = metaCampReachMap.get(String(camp.meta_id));
      }

      let finalVal = 0;
      let finalLabel = 'Resultados';
      let isCPM = false;
      let cpr = 0;

      const obj = (camp.objetivo || '').toUpperCase();

      if (obj.includes('TRAFFIC')) {
        const hasNativeVisits = total.visitas_perfil > 0;
        if (hasNativeVisits) {
          finalVal = total.visitas_perfil; 
          finalLabel = 'Visitas';
        } else {
          finalVal = total.cliques;
          finalLabel = 'Cliques no Link';
        }
        cpr = finalVal > 0 ? (total.valor_investido / finalVal) : 0;
      } else if (obj.includes('AWARENESS') || obj.includes('REACH')) {
        finalVal = total.impressoes;
        finalLabel = 'Impressões';
        cpr = total.impressoes > 0 ? (total.valor_investido / (total.impressoes / 1000)) : 0;
        isCPM = true;
      } else if (obj.includes('ENGAGEMENT')) {
        if (total.conversas_leads > 0) {
           finalVal = total.conversas_leads;
           finalLabel = 'Leads';
           cpr = finalVal > 0 ? (total.valor_investido / finalVal) : 0;
        } else {
           finalVal = total.engajamentoTotal;
           finalLabel = 'Engajamentos';
           cpr = finalVal > 0 ? (total.valor_investido / finalVal) : 0;
        }
      } else if (obj.includes('MESSAGING') || obj.includes('LEADS') || obj.includes('CONVERSIONS') || obj.includes('OUTCOME_LEADS') || total.conversas_leads > 0) {
        finalVal = total.conversas_leads;
        finalLabel = 'Leads';
        cpr = finalVal > 0 ? (total.valor_investido / finalVal) : 0;
      } else if (obj.includes('SALES')) {
        finalVal = total.compras;
        finalLabel = 'Vendas';
        cpr = finalVal > 0 ? (total.valor_investido / finalVal) : 0;
      } else {
        finalVal = total.conversas_leads > 0 ? total.conversas_leads : total.visitas_perfil;
        finalLabel = total.conversas_leads > 0 ? 'Leads' : 'Visitas';
        cpr = finalVal > 0 ? (total.valor_investido / finalVal) : 0;
      }

      return {
        ...total, 
        objetivo: finalLabel, 
        resultadoBruto: finalVal,
        roas: total.valor_investido > 0 ? total.valor_compras / total.valor_investido : 0,
        cpr: cpr,
        isCPM: isCPM,
        campanha: { id: camp.id, nome_gerado: camp.nome_gerado, meta_id: camp.meta_id }
      };
    }).filter(m => m.valor_investido > 0 || m.resultadoBruto > 0);

    const criativosRaw = await prisma.criativo.findMany({    
      where: { campanha: { cliente_id: cliente.id } },       
      include: { metricas: { where: { data: { gte: dateSince, lte: dateUntil } } } }
    });

    const groupedMap = new Map();
    for (const c of criativosRaw) {
      const rawName = c.nome_anuncio || 'Anúncio sem nome';      
      const key = rawName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'ANUNCIOSEMNOME';
      const stats = c.metricas.reduce((acc, m) => ({
        impressoes: acc.impressoes + m.impressoes,
        alcance: Math.max(acc.alcance, m.alcance),
        cliques: acc.cliques + m.cliques,
        valor_investido: acc.valor_investido + Number(m.valor_investido),
        leads: acc.leads + m.leads,
        compras: acc.compras + m.compras,
        reacoes_sociais: acc.reacoes_sociais + m.reacoes_sociais,
        totalCtr: acc.totalCtr + Number(m.ctr || 0),
        count: acc.count + 1
      }), { impressoes: 0, alcance: 0, cliques: 0, valor_investido: 0, leads: 0, compras: 0, totalCtr: 0, count: 0, reacoes_sociais: 0 });    

      // Não exibe criativos que quase não tiveram veiculação no período selecionado (gasto irrisório e pouquíssimas impressões/leads)
      if ((stats.valor_investido < 0.05 && stats.impressoes < 10) && stats.leads === 0) continue;

      let liveAlcance = stats.alcance;
      if (c.meta_ad_id && metaAdReachMap.has(String(c.meta_ad_id))) {
        liveAlcance = metaAdReachMap.get(String(c.meta_ad_id));
      }

      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          id: c.id, nome_anuncio: rawName, url_midia: c.url_midia, texto_principal: c.texto_principal,
          ...stats,
          alcance: liveAlcance
        });
      } else {
        const existing = groupedMap.get(key);
        existing.impressoes += stats.impressoes;
        existing.alcance += liveAlcance;
        existing.cliques += stats.cliques;
        existing.valor_investido += stats.valor_investido;   
        existing.leads += stats.leads;
        existing.compras += stats.compras;
        existing.totalCtr += stats.totalCtr;
        existing.count += stats.count;
        if (!existing.url_midia) existing.url_midia = c.url_midia;
      }
    }

    const criativos = Array.from(groupedMap.values()).map(c => {
      return {
        ...c, 
        ctr: c.count > 0 ? c.totalCtr / c.count : 0      
      };
    });

    // --- REFRESH IMAGE URLs FROM META ---
    try {
      const ACCESS_TOKEN_REFRESH = process.env[`META_ACCESS_TOKEN_${slug.toUpperCase()}`] || 
                                   process.env[`META_ACCESS_TOKEN_${slug}`] ||
                                   process.env[`META_ACCESS_TOKEN_GLOBAL`] || 
                                   cliente?.meta_access_token;
      const rawAccountIdRefresh = process.env[`META_AD_ACCOUNT_ID_${slug.toUpperCase()}`] || 
                                  process.env[`META_AD_ACCOUNT_ID_${slug}`] ||
                                  cliente?.meta_ads_account_id;
      const AD_ACCOUNT_REFRESH = rawAccountIdRefresh?.startsWith('act_') ? rawAccountIdRefresh : (rawAccountIdRefresh ? `act_${rawAccountIdRefresh}` : null);

      if (ACCESS_TOKEN_REFRESH && AD_ACCOUNT_REFRESH) {
        const [adsListRefreshData, adCreativesRefreshData] = await Promise.all([
          fetchMetaInsights(graphUrl(`${AD_ACCOUNT_REFRESH}/ads`, { access_token: ACCESS_TOKEN_REFRESH, fields: 'id,creative{id}', limit: '1000' })),
          fetchMetaInsights(graphUrl(`${AD_ACCOUNT_REFRESH}/adcreatives`, { access_token: ACCESS_TOKEN_REFRESH, fields: 'id,image_url,thumbnail_url,image_hash,effective_object_story_id', thumbnail_width: 800, thumbnail_height: 800, limit: '1000' }))
        ]);
        const adToCreativeRefresh = new Map(adsListRefreshData?.map(a => [a.id, a.creative?.id]) || []);
        const creativeRefreshMap = new Map(adCreativesRefreshData?.map(c => [String(c.id), c]) || []);

        const storyIdsRefresh = adCreativesRefreshData?.map(c => c.effective_object_story_id).filter(id => !!id) || [];
        const storyRefreshMap = new Map();
        if (storyIdsRefresh.length > 0) {
          for (let i = 0; i < storyIdsRefresh.length; i += 50) {
            const chunk = storyIdsRefresh.slice(i, i + 50);
            try {
              const stRes = await fetch(graphUrl('', { ids: chunk.join(','), fields: 'id,full_picture', access_token: ACCESS_TOKEN_REFRESH }));
              const stData = await stRes.json();
              if (!stData.error) Object.values(stData).forEach(post => { if (post.full_picture) storyRefreshMap.set(post.id, post.full_picture); });
            } catch (e) { }
          }
        }

        const imageHashRefreshMap = new Map();
        const hashesRefresh = [...new Set(adCreativesRefreshData?.map(c => c.image_hash).filter(h => !!h) || [])];
        if (hashesRefresh.length > 0) {
          for (let i = 0; i < hashesRefresh.length; i += 50) {
            const chunk = hashesRefresh.slice(i, i + 50);
            try {
              const hRes = await fetch(graphUrl(`${AD_ACCOUNT_REFRESH}/adimages`, { access_token: ACCESS_TOKEN_REFRESH, hashes: JSON.stringify(chunk), fields: 'url,permalink_url,hash' }));
              const hData = await hRes.json();
              if (hData.data) hData.data.forEach(img => { const u = img.url || img.permalink_url; if (u) imageHashRefreshMap.set(img.hash, u); });
            } catch (e) { }
          }
        }

        const freshUrlMap = new Map();
        for (const c of criativosRaw) {
          if (!c.meta_ad_id) continue;
          const creativeId = adToCreativeRefresh.get(String(c.meta_ad_id));
          const creativeMeta = creativeRefreshMap.get(String(creativeId)) || {};
          const highRes = imageHashRefreshMap.get(creativeMeta.image_hash)
                       || storyRefreshMap.get(creativeMeta.effective_object_story_id)
                       || creativeMeta.image_url
                       || creativeMeta.thumbnail_url;
          if (highRes) freshUrlMap.set(c.meta_ad_id, highRes);
        }

        const nameToFreshUrl = new Map();
        for (const c of criativosRaw) {
          const rawKey = c.nome_anuncio || 'Anúncio sem nome';
          const key = rawKey.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'ANUNCIOSEMNOME';
          if (c.meta_ad_id && freshUrlMap.has(c.meta_ad_id) && !nameToFreshUrl.has(key)) {
            nameToFreshUrl.set(key, freshUrlMap.get(c.meta_ad_id));
          }
        }

        criativos.forEach(c => {
          const rawKey = c.nome_anuncio || 'Anúncio sem nome';
          const key = rawKey.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'ANUNCIOSEMNOME';
          if (nameToFreshUrl.has(key)) {
            c.url_midia = nameToFreshUrl.get(key);
          }
        });
        Promise.all([...freshUrlMap.entries()].map(([adId, url]) => prisma.criativo.updateMany({ where: { meta_ad_id: adId }, data: { url_midia: url } }).catch(() => {}))).catch(() => {});
      }
    } catch (e) { console.error('Refresh creative URLs failed:', e); }

    const dailyMap = new Map();
    for (const camp of campanhas) {
      const obj = (camp.objetivo || '').toUpperCase();
      const isConversionCamp = obj.includes('MESSAGING') || obj.includes('LEADS') || obj.includes('CONVERSIONS') || obj.includes('OUTCOME_LEADS') || obj.includes('OUTCOME_ENGAGEMENT');
      for (const m of camp.metricas) {
        const dateKey = m.data.toISOString().split('T')[0];  
        if (!dailyMap.has(dateKey)) dailyMap.set(dateKey, { data: dateKey, mensagens: 0, investimentoTotal: 0, investimentoConversao: 0 });
        const day = dailyMap.get(dateKey);
        day.mensagens += m.conversas_leads;
        day.investimentoTotal += Number(m.valor_investido);  
        if (isConversionCamp) day.investimentoConversao += Number(m.valor_investido);
      }
    }
    const dailyMetrics = Array.from(dailyMap.values())       
      .sort((a, b) => a.data.localeCompare(b.data))
      .map(d => ({
        ...d,
        investimento: parseFloat(d.investimentoTotal.toFixed(2)),
        cpl: d.mensagens > 0 ? parseFloat((d.investimentoConversao / d.mensagens).toFixed(2)) : 0,
        cpa: d.mensagens > 0 ? parseFloat((d.investimentoConversao / d.mensagens).toFixed(2)) : 0,
      }));

    const totalReach = metaAccountTotals ? parseInt(metaAccountTotals.reach) : metrics.reduce((a,c)=>a+c.alcance, 0);

    // --- AUDITORIA DE GARANTIA E CONFORMIDADE DE DADOS ---
    const dbTotalSpend = metrics.reduce((acc, m) => acc + (parseFloat(m.valor_investido) || 0), 0);
    const dbTotalImpressions = metrics.reduce((acc, m) => acc + (parseInt(m.impressoes) || 0), 0);

    let audit = {
      verified: false,
      metaSpend: 0,
      dbSpend: parseFloat(dbTotalSpend.toFixed(2)),
      metaImpressions: 0,
      dbImpressions: dbTotalImpressions,
      discrepancySpend: 0,
      discrepancyImpressions: 0
    };

    if (metaAccountTotals) {
      audit.metaSpend = parseFloat(parseFloat(metaAccountTotals.spend || 0).toFixed(2));
      audit.metaImpressions = parseInt(metaAccountTotals.impressions) || 0;
      audit.discrepancySpend = parseFloat(Math.abs(audit.metaSpend - audit.dbSpend).toFixed(2));
      audit.discrepancyImpressions = Math.abs(audit.metaImpressions - audit.dbImpressions);
      
      // Margem de tolerância de R$ 0.05 para spend, e 0.1% para impressões (com mínimo de 10) para evitar travar por desvios de fuso horário
      const impressionTolerance = Math.round(audit.metaImpressions * 0.001);
      if (audit.discrepancySpend <= 0.05 && audit.discrepancyImpressions <= Math.max(10, impressionTolerance)) {
        audit.verified = true;
      }
    }

    // --- CÁLCULO DE SEGUIDORES GANHOS NO PERÍODO ---
    let followersDelta = 0;
    try {
      const rangeMetrics = await prisma.metricaContaDiaria.findMany({
        where: {
          cliente_id: cliente.id,
          data: {
            gte: dateSince,
            lte: dateUntil
          }
        },
        orderBy: { data: 'asc' }
      });

      if (rangeMetrics.length >= 2) {
        const oldestInRange = rangeMetrics[0].followers_count;
        const newestInRange = rangeMetrics[rangeMetrics.length - 1].followers_count;
        followersDelta = newestInRange - oldestInRange;
      } else if (rangeMetrics.length === 1) {
        const previousMetric = await prisma.metricaContaDiaria.findFirst({
          where: {
            cliente_id: cliente.id,
            data: {
              lt: dateSince
            }
          },
          orderBy: { data: 'desc' },
          select: { followers_count: true }
        });
        if (previousMetric) {
          followersDelta = rangeMetrics[0].followers_count - previousMetric.followers_count;
        }
      }
    } catch (e) {
      console.error("Erro ao calcular delta de seguidores no sync:", e);
    }

    return NextResponse.json({ success: true, metrics, criativos, dailyMetrics, totalReach, lastSyncDate, audit, followersDelta });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const startTime = performance.now();
  
  try {
    const body = await request.clone().json().catch(() => ({}));
    const { since, until, cliente, forceFullSync, timeBudget } = body;
    const timeBudgetMs = timeBudget || 50000; // default 50s budget

    if (!cliente) return NextResponse.json({ success: false, error: "Cliente não fornecido" }, { status: 400 });

    const slug = cliente.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '');
    const shortName = cliente.normalize('NFD').replace(/[\u0300-\u036f]/g, "").split(' ')[0].replace(/[^a-zA-Z0-9]/g, '');

    const dbCliente = await prisma.cliente.findFirst({ 
      where: { 
        OR: [
          { nome: { equals: cliente, mode: 'insensitive' } },
          { slug: { equals: slug, mode: 'insensitive' } },
          { slug: { equals: cliente.toLowerCase().replace(/ /g, ''), mode: 'insensitive' } }
        ]
      } 
    });
    
    const ACCESS_TOKEN = process.env[`META_ACCESS_TOKEN_${slug.toUpperCase()}`] || 
                         process.env[`META_ACCESS_TOKEN_${slug}`] ||
                         process.env[`META_ACCESS_TOKEN_${shortName.toUpperCase()}`] ||
                         process.env[`META_ACCESS_TOKEN_${shortName}`] ||
                         process.env[`META_ACCESS_TOKEN_GLOBAL`] || 
                         dbCliente?.meta_access_token;

    const rawAccountId = process.env[`META_AD_ACCOUNT_ID_${slug.toUpperCase()}`] || 
                         process.env[`META_AD_ACCOUNT_ID_${slug}`] ||
                         process.env[`META_AD_ACCOUNT_ID_${shortName.toUpperCase()}`] ||
                         process.env[`META_AD_ACCOUNT_ID_${shortName}`] ||
                         dbCliente?.meta_ads_account_id;

    const AD_ACCOUNT_ID = rawAccountId?.startsWith('act_') ? rawAccountId : (rawAccountId ? `act_${rawAccountId}` : null);
    
    if (!ACCESS_TOKEN) throw new Error(`Token de Acesso não encontrado para ${cliente}.`);
    if (!AD_ACCOUNT_ID) throw new Error(`ID da Conta não encontrado para ${cliente}.`);

    let targetCliente = dbCliente;
    if (!targetCliente) {
      targetCliente = await prisma.cliente.create({
        data: {
          nome: cliente,
          meta_ads_account_id: AD_ACCOUNT_ID,
          meta_access_token: ACCESS_TOKEN,
          insights: `# Contexto Automático via Antigravity\nEmpresa vinculada via Variáveis de Ambiente.`
        }
      });
    }

    // --- 1. Resolução do Timezone da Conta ---
    const timezone = await getAccountTimezone(AD_ACCOUNT_ID, ACCESS_TOKEN);

    // --- 2. Sliding Window com Timezone ---
    let finalSince = since;
    let finalUntil = until;
    const todayStr = getLocalDateString(new Date(), timezone);

    if (!forceFullSync) {
      // Rolling window rígida de 7 dias para conversões tardias
      const sevenDaysAgoStr = getLocalDateNDaysAgo(timezone, 7);
      if (!since || new Date(since) > new Date(sevenDaysAgoStr)) {
        finalSince = sevenDaysAgoStr;
      }
    }

    if (!finalUntil) {
      finalUntil = todayStr;
    }

    const commonQuery = { access_token: ACCESS_TOKEN, limit: '250' };
    if (finalUntil === todayStr && finalSince === todayStr) {
      commonQuery.date_preset = 'today';
    } else {
      commonQuery.time_range = JSON.stringify({ since: finalSince, until: finalUntil });
    }

    console.log(`[BulletproofSync] Syncing ${cliente} range: ${finalSince} to ${finalUntil} (Timezone: ${timezone})`);

    let isPartial = false;
    let campaignsList = [];
    let adsetsList = [];
    let campaignData = [];
    let adInsightData = [];
    let adsMetaDataList = [];

    // --- 3. Coleta de Dados via Paginação Rígida com monitoramento de Timeout ---
    try {
      // 3.1 campaigns
      const campaignsUrl = graphUrl(`${AD_ACCOUNT_ID}/campaigns`, { access_token: ACCESS_TOKEN, fields: 'id,name,objective', limit: '250' });
      campaignsList = await fetchMetaPaginated(campaignsUrl, startTime, timeBudgetMs);

      // 3.2 adsets
      const adsetsUrl = graphUrl(`${AD_ACCOUNT_ID}/adsets`, { access_token: ACCESS_TOKEN, fields: 'campaign_id,destination_type,optimization_goal', limit: '250' });
      adsetsList = await fetchMetaPaginated(adsetsUrl, startTime, timeBudgetMs);

      // 3.3 campaign insights
      const insightFields = 'campaign_id,campaign_name,spend,impressions,reach,inline_link_click_ctr,clicks,inline_link_clicks,outbound_clicks,actions,action_values';
      const campaignDataUrl = graphUrl(`${AD_ACCOUNT_ID}/insights`, { ...commonQuery, fields: insightFields, level: 'campaign', time_increment: '1' });
      campaignData = await fetchMetaPaginated(campaignDataUrl, startTime, timeBudgetMs);

      // 3.4 ad insights
      const adInsightFields = 'ad_id,ad_name,campaign_id,spend,impressions,reach,inline_link_click_ctr,clicks,inline_link_clicks,outbound_clicks,actions,action_values';
      const adInsightDataUrl = graphUrl(`${AD_ACCOUNT_ID}/insights`, { ...commonQuery, fields: adInsightFields, level: 'ad', time_increment: '1' });
      adInsightData = await fetchMetaPaginated(adInsightDataUrl, startTime, timeBudgetMs);

      // 3.5 ad creatives list
      const adsMetaUrl = graphUrl(`${AD_ACCOUNT_ID}/adcreatives`, { 
        access_token: ACCESS_TOKEN, 
        fields: 'id,image_url,thumbnail_url,image_hash,body,effective_object_story_id', 
        thumbnail_width: 800, 
        thumbnail_height: 800, 
        limit: '250' 
      });
      adsMetaDataList = await fetchMetaPaginated(adsMetaUrl, startTime, timeBudgetMs);

    } catch (err) {
      if (err instanceof TimeoutApproachingError) {
        isPartial = true;
        console.warn(`[BulletproofSync] Timeout se aproximando durante a busca na Meta API. Salvando dados parciais.`);
        if (err.partialData && Array.isArray(err.partialData)) {
          if (campaignsList.length === 0) campaignsList = err.partialData;
          else if (adsetsList.length === 0) adsetsList = err.partialData;
          else if (campaignData.length === 0) campaignData = err.partialData;
          else if (adInsightData.length === 0) adInsightData = err.partialData;
          else if (adsMetaDataList.length === 0) adsMetaDataList = err.partialData;
        }
      } else {
        throw err;
      }
    }

    const objectiveMap = new Map(campaignsList.map(c => [c.id, c.objective]) || []);
    const creativeMetaMap = new Map(adsMetaDataList.map(m => [String(m.id), m]) || []);

    const campaignDestinationMap = new Map();
    if (adsetsList) {
      adsetsList.forEach(adset => {
        if (adset.campaign_id) {
          const current = campaignDestinationMap.get(String(adset.campaign_id)) || [];
          current.push({
            destination_type: adset.destination_type,
            optimization_goal: adset.optimization_goal
          });
          campaignDestinationMap.set(String(adset.campaign_id), current);
        }
      });
    }

    // --- 4. Resolução de Imagens High-Res com monitoramento de Timeout ---
    const storyIds = adsMetaDataList.map(m => m.effective_object_story_id).filter(id => !!id) || [];
    const storyMetaMap = new Map();
    if (storyIds.length > 0 && !isPartial) {
       for (let i = 0; i < storyIds.length; i += 50) {
         if (performance.now() - startTime > timeBudgetMs - 2000) {
           isPartial = true;
           break;
         }
         const chunk = storyIds.slice(i, i + 50);
         try {
           const res = await fetchMetaWithRetry(graphUrl(``, { ids: chunk.join(','), fields: 'id,full_picture', access_token: ACCESS_TOKEN }), {}, startTime, timeBudgetMs);
           Object.values(res).forEach(post => storyMetaMap.set(post.id, post.full_picture));
         } catch (e) {
           console.error("[BulletproofSync] Erro ao resolver imagens de posts:", e.message);
         }
       }
    }

    const imageHashMap = new Map();
    const uniqueHashes = [...new Set(adsMetaDataList.map(m => m.image_hash).filter(h => !!h) || [])];
    if (uniqueHashes.length > 0 && !isPartial) {
       for (let i = 0; i < uniqueHashes.length; i += 50) {
         if (performance.now() - startTime > timeBudgetMs - 2000) {
           isPartial = true;
           break;
         }
         const chunk = uniqueHashes.slice(i, i + 50);
         try {
           const res = await fetchMetaWithRetry(graphUrl(`${AD_ACCOUNT_ID}/adimages`, { access_token: ACCESS_TOKEN, hashes: JSON.stringify(chunk), fields: 'url,permalink_url,hash' }), {}, startTime, timeBudgetMs);
           if (res.data) res.data.forEach(img => { const bestUrl = img.url || img.permalink_url; if (bestUrl) imageHashMap.set(img.hash, bestUrl); });
         } catch (e) {
           console.error("[BulletproofSync] Erro ao resolver hashes de imagens:", e.message);
         }
       }
    }

    // --- 5. Persistência de Dados no Banco de Dados via Prisma (Idempotência) ---
    const localCampMap = new Map();
    const uniqueCampaigns = [...new Map(campaignData.map(item => [item.campaign_id, item])).values()];
    for (const item of uniqueCampaigns) {
      if (performance.now() - startTime > timeBudgetMs - 1500) {
        isPartial = true;
        break;
      }
      const camp = await prisma.campanha.upsert({
        where: { meta_id: String(item.campaign_id) },      
        update: { nome_gerado: item.campaign_name, objetivo: objectiveMap.get(item.campaign_id) || 'UNKNOWN' },
        create: { meta_id: String(item.campaign_id), nome_gerado: item.campaign_name, cliente_id: targetCliente.id, objetivo: objectiveMap.get(item.campaign_id) || 'UNKNOWN', tipo_orcamento: 'UNKNOWN' }
      });
      localCampMap.set(camp.meta_id, camp);
    }

    // Processamento de métricas diárias de campanhas
    await batchProcess(campaignData, 10, async (item) => {
      if (performance.now() - startTime > timeBudgetMs - 1500) {
        isPartial = true;
        return;
      }
      let camp = localCampMap.get(String(item.campaign_id));
      if (!camp) {
        // Upsert dinâmico para garantir o salvamento de campanhas inativas/deletadas
        camp = await prisma.campanha.upsert({
          where: { meta_id: String(item.campaign_id) },
          update: { nome_gerado: item.campaign_name },
          create: {
            meta_id: String(item.campaign_id),
            nome_gerado: item.campaign_name,
            cliente_id: targetCliente.id,
            objetivo: 'UNKNOWN',
            tipo_orcamento: 'UNKNOWN'
          }
        });
        localCampMap.set(camp.meta_id, camp);
      }

      const dataInsight = new Date(item.date_start + 'T00:00:00.000Z');
      const linkClicks = parseInt(item.inline_link_clicks) || 0;
      const outboundClicks = Array.isArray(item.outbound_clicks) ? item.outbound_clicks.reduce((acc, c) => acc + (parseInt(c.value) || 0), 0) : 0;
      const nativeVisits = getMetric(item.actions, 'onsite_conversion.instagram_profile_visit');
      
      const isInstagramProfileCampaign = (campaignDestinationMap.get(String(item.campaign_id)) || []).some(
        a => a.destination_type === 'INSTAGRAM_PROFILE' || a.optimization_goal === 'PROFILE_VISIT'
      );

      // Heurística de Atribuição Universal
      let totalVisitas = 0;
      const calibrationRate = campaignCalibrationMap[String(item.campaign_id)];
      if (calibrationRate !== undefined) {
        totalVisitas = Math.round(linkClicks * calibrationRate);
      } else if (isInstagramProfileCampaign) {
        totalVisitas = Math.max(0, linkClicks - outboundClicks);
      } else if (nativeVisits > 0) {
        totalVisitas = linkClicks + nativeVisits;
      } else if (outboundClicks > (linkClicks * 0.5)) {
        totalVisitas = Math.abs(linkClicks - outboundClicks);
      } else {
        totalVisitas = linkClicks;
      }

      const leadsVal = getTrueLeads(item.actions, item.campaign_name);

      return prisma.metricaCampanha.upsert({
        where: { campanha_id_data: { campanha_id: camp.id, data: dataInsight } },
        update: {
          impressoes: parseInt(item.impressions) || 0, alcance: parseInt(item.reach) || 0, cliques: linkClicks,
          visitas_perfil: totalVisitas, seguidores: getMetric(item.actions, 'onsite_conversion.follow') + getMetric(item.actions, 'page_like') + getMetric(item.actions, 'onsite_conversion.instagram_profile_follow'),
          reacoes_sociais: getSocialActions(item.actions), valor_investido: parseFloat(item.spend) || 0,
          conversas_leads: leadsVal, compras: getMetric(item.actions, 'purchase'), valor_compras: getMetric(item.action_values, 'purchase', true)    
        },
        create: {
          campanha_id: camp.id, data: dataInsight,
          impressoes: parseInt(item.impressions) || 0, alcance: parseInt(item.reach) || 0, cliques: linkClicks,
          visitas_perfil: totalVisitas, seguidores: getMetric(item.actions, 'onsite_conversion.follow') + getMetric(item.actions, 'page_like') + getMetric(item.actions, 'onsite_conversion.instagram_profile_follow'),
          reacoes_sociais: getSocialActions(item.actions), valor_investido: parseFloat(item.spend) || 0,
          conversas_leads: leadsVal, compras: getMetric(item.actions, 'purchase'), valor_compras: getMetric(item.action_values, 'purchase', true)    
        }
      });
    });

    // Processamento de criativos e métricas de anúncios
    if (adInsightData.length > 0) {
      const adsListUrl = graphUrl(`${AD_ACCOUNT_ID}/ads`, { access_token: ACCESS_TOKEN, fields: 'id,creative{id}', limit: '250' });
      const adsList = await fetchMetaPaginated(adsListUrl, startTime, timeBudgetMs).catch(() => []);
      const adToCreativeMap = new Map(adsList.map(a => [a.id, a.creative?.id]) || []);

      await batchProcess(adInsightData, 10, async (row) => {
        if (performance.now() - startTime > timeBudgetMs - 1500) {
          isPartial = true;
          return;
        }
        let camp = localCampMap.get(String(row.campaign_id));
        if (!camp) {
          let dbCamp = await prisma.campanha.findUnique({ where: { meta_id: String(row.campaign_id) } });
          if (!dbCamp) {
            dbCamp = await prisma.campanha.create({
              data: {
                meta_id: String(row.campaign_id),
                nome_gerado: `Campanha #${row.campaign_id}`,
                cliente_id: targetCliente.id,
                objetivo: 'UNKNOWN',
                tipo_orcamento: 'UNKNOWN'
              }
            });
          }
          localCampMap.set(dbCamp.meta_id, dbCamp);
          camp = dbCamp;
        }
        const creativeId = adToCreativeMap.get(String(row.ad_id));
        const adMeta = creativeMetaMap.get(String(creativeId)) || {};
        const highResImage = imageHashMap.get(adMeta.image_hash) || storyMetaMap.get(adMeta.effective_object_story_id) || adMeta.image_url || adMeta.thumbnail_url;

        const criativo = await prisma.criativo.upsert({      
          where: { meta_ad_id: String(row.ad_id) },
          update: { nome_anuncio: row.ad_name, url_midia: highResImage, texto_principal: adMeta.body },
          create: { meta_ad_id: String(row.ad_id), campanha_id: camp.id, nome_anuncio: row.ad_name, url_midia: highResImage, texto_principal: adMeta.body }
        });

        const dataInsight = new Date(row.date_start + 'T00:00:00.000Z');
        const leadsVal = getTrueLeads(row.actions, camp?.nome_gerado || '');

        return prisma.metricaCriativo.upsert({
          where: { criativo_id_data: { criativo_id: criativo.id, data: dataInsight } },
          update: {
            impressoes: parseInt(row.impressions) || 0, alcance: parseInt(row.reach) || 0, cliques: parseInt(row.inline_link_clicks) || 0,
            ctr: parseFloat(row.inline_link_click_ctr) || 0, valor_investido: parseFloat(row.spend) || 0,
            leads: leadsVal, compras: getMetric(row.actions, 'purchase'), reacoes_sociais: getSocialActions(row.actions)
          },
          create: {
            criativo_id: criativo.id, data: dataInsight, impressoes: parseInt(row.impressions) || 0, alcance: parseInt(row.reach) || 0,
            cliques: parseInt(row.inline_link_clicks) || 0, ctr: parseFloat(row.inline_link_click_ctr) || 0,
            valor_investido: parseFloat(row.spend) || 0, leads: leadsVal, compras: getMetric(row.actions, 'purchase'), reacoes_sociais: getSocialActions(row.actions)
          }
        });
      });
    }

    return NextResponse.json({ success: true, isPartial });
  } catch (error) {
    console.error("POST BulletproofSync Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
