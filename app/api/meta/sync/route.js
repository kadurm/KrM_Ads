import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

function graphUrl(path, query) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });
  return url.toString();
}

/**
 * Robust fetch that follows pagination and checks for errors
 */
async function fetchMetaInsights(url) {
  let allData = [];
  let currentUrl = url;

  while (currentUrl) {
    const res = await fetch(currentUrl);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Meta API Error: ${err.error?.message || res.statusText}`);
    }
    const json = await res.json();
    if (json.data) allData = [...allData, ...json.data];
    currentUrl = json.paging?.next || null;
  }
  return allData;
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

function getTrueLeads(actions) {
  if (!Array.isArray(actions)) return 0;
  const msgReply = getMetric(actions, 'onsite_conversion.messaging_first_reply');
  const msgStarted = getMetric(actions, 'onsite_conversion.messaging_conversation_started_7d');
  const standardLead = getMetric(actions, 'lead');
  const leadGen = getMetric(actions, 'onsite_conversion.lead_grouped');
  const fbContact = getMetric(actions, 'contact');
  const customPixel = getMetric(actions, 'offsite_conversion.fb_pixel_custom');
  // Leads = Conversas Iniciadas OU Leads de Formulario OU Contatos OU Custom Pixel
  // Math.max garante que não contemos 2x se a Meta reportar messaging_first_reply e conversation_started
  return Math.max(msgReply, msgStarted) + Math.max(standardLead, leadGen) + fbContact + customPixel;
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
    }).filter(m => m.impressoes > 0 || m.valor_investido > 0);

    const criativosRaw = await prisma.criativo.findMany({    
      where: { campanha: { cliente_id: cliente.id } },       
      include: { metricas: { where: { data: { gte: dateSince, lte: dateUntil } } } }
    });

    const groupedMap = new Map();
    for (const c of criativosRaw) {
      const key = c.nome_anuncio || 'Anúncio sem nome';      
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

      if (stats.impressoes === 0 && stats.valor_investido === 0) continue;

      let liveAlcance = stats.alcance;
      if (c.meta_ad_id && metaAdReachMap.has(String(c.meta_ad_id))) {
        liveAlcance = metaAdReachMap.get(String(c.meta_ad_id));
      }

      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          id: c.id, nome_anuncio: key, url_midia: c.url_midia, texto_principal: c.texto_principal,
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
          const key = c.nome_anuncio || 'Anúncio sem nome';
          if (c.meta_ad_id && freshUrlMap.has(c.meta_ad_id) && !nameToFreshUrl.has(key)) {
            nameToFreshUrl.set(key, freshUrlMap.get(c.meta_ad_id));
          }
        }

        criativos.forEach(c => { if (nameToFreshUrl.has(c.nome_anuncio)) c.url_midia = nameToFreshUrl.get(c.nome_anuncio); });
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
      
      // Margem de tolerância de R$ 0.05 para arredondamentos e 0 impressões de diferença
      if (audit.discrepancySpend <= 0.05 && audit.discrepancyImpressions === 0) {
        audit.verified = true;
      }
    }

    return NextResponse.json({ success: true, metrics, criativos, dailyMetrics, totalReach, lastSyncDate, audit });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { since, until, cliente, forceFullSync } = await request.json();
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

    // --- Sliding Window Logic ---
    let finalSince = since;
    let finalUntil = until;
    const today = new Date();
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(today.getDate() - 5);
    const fiveDaysAgoStr = fiveDaysAgo.toISOString().split('T')[0];

    if (!forceFullSync && (!since || (since && new Date(since) > fiveDaysAgo))) {
      finalSince = fiveDaysAgoStr;
    }

    const commonQuery = { access_token: ACCESS_TOKEN, limit: '1000' };
    const todayStr = new Date().toISOString().split('T')[0];
    if (finalUntil === todayStr && finalSince === todayStr) commonQuery.date_preset = 'today';
    else commonQuery.time_range = JSON.stringify({ since: finalSince, until: finalUntil });

    console.log(`[BulletproofSync] Syncing ${cliente} range: ${finalSince} to ${finalUntil || todayStr}`);

    // 1. Fetch Basic Info & Objectives
    const metaCampsRes = await fetch(graphUrl(`${AD_ACCOUNT_ID}/campaigns`, { access_token: ACCESS_TOKEN, fields: 'id,name,objective', limit: '1000' }));
    if (!metaCampsRes.ok) throw new Error("Falha ao buscar campanhas na Meta.");
    const metaCampsData = await metaCampsRes.json();
    const objectiveMap = new Map(metaCampsData.data?.map(c => [c.id, c.objective]) || []);

    // 2. Fetch Insights (following pagination)
    const insightFields = 'campaign_id,campaign_name,spend,impressions,reach,inline_link_click_ctr,clicks,inline_link_clicks,outbound_clicks,actions,action_values';
    const campaignData = await fetchMetaInsights(graphUrl(`${AD_ACCOUNT_ID}/insights`, { ...commonQuery, fields: insightFields, level: 'campaign', time_increment: '1' }));
    
    const adInsightFields = 'ad_id,ad_name,campaign_id,spend,impressions,reach,inline_link_click_ctr,clicks,inline_link_clicks,outbound_clicks,actions,action_values';
    const adInsightData = await fetchMetaInsights(graphUrl(`${AD_ACCOUNT_ID}/insights`, { ...commonQuery, fields: adInsightFields, level: 'ad', time_increment: '1' }));

    // 3. Fetch Creative Metadata
    const adsMetaRes = await fetch(graphUrl(`${AD_ACCOUNT_ID}/adcreatives`, { access_token: ACCESS_TOKEN, fields: 'id,image_url,thumbnail_url,image_hash,body,effective_object_story_id', thumbnail_width: 800, thumbnail_height: 800, limit: '1000' }));
    const adsMetaData = await adsMetaRes.json();
    const creativeMetaMap = new Map(adsMetaData.data?.map(m => [String(m.id), m]) || []);

    // 4. Resolve High-Res Story Post Images
    const storyIds = adsMetaData.data?.map(m => m.effective_object_story_id).filter(id => !!id) || [];
    const storyMetaMap = new Map();
    if (storyIds.length > 0) {
       for (let i = 0; i < storyIds.length; i += 50) {
         const chunk = storyIds.slice(i, i + 50);
         const res = await fetch(graphUrl(``, { ids: chunk.join(','), fields: 'id,full_picture', access_token: ACCESS_TOKEN }));
         const data = await res.json();
         Object.values(data).forEach(post => storyMetaMap.set(post.id, post.full_picture));
       }
    }

    // 5. Resolve High-Res via Hashes
    const imageHashMap = new Map();
    const uniqueHashes = [...new Set(adsMetaData.data?.map(m => m.image_hash).filter(h => !!h) || [])];
    if (uniqueHashes.length > 0) {
       for (let i = 0; i < uniqueHashes.length; i += 50) {
         const chunk = uniqueHashes.slice(i, i + 50);
         const res = await fetch(graphUrl(`${AD_ACCOUNT_ID}/adimages`, { access_token: ACCESS_TOKEN, hashes: JSON.stringify(chunk), fields: 'url,permalink_url,hash' }));
         const data = await res.json();
         if (data.data) data.data.forEach(img => { const bestUrl = img.url || img.permalink_url; if (bestUrl) imageHashMap.set(img.hash, bestUrl); });
       }
    }

    // 6. Ensure Campaigns exist in DB (Sequential to avoid race conditions)
    const localCampMap = new Map();
    const uniqueCampaigns = [...new Map(campaignData.map(item => [item.campaign_id, item])).values()];
    for (const item of uniqueCampaigns) {
      const camp = await prisma.campanha.upsert({
        where: { meta_id: String(item.campaign_id) },      
        update: { nome_gerado: item.campaign_name, objetivo: objectiveMap.get(item.campaign_id) || 'UNKNOWN' },
        create: { meta_id: String(item.campaign_id), nome_gerado: item.campaign_name, cliente_id: targetCliente.id, objetivo: objectiveMap.get(item.campaign_id) || 'UNKNOWN', tipo_orcamento: 'UNKNOWN' }
      });
      localCampMap.set(camp.meta_id, camp);
    }

    // 7. Process Daily Insights (Batch)
    await batchProcess(campaignData, 10, async (item) => {
      const camp = localCampMap.get(String(item.campaign_id));
      const dataInsight = new Date(item.date_start + 'T00:00:00.000Z');
      const linkClicks = parseInt(item.inline_link_clicks) || 0;
      const outboundClicks = Array.isArray(item.outbound_clicks) ? item.outbound_clicks.reduce((acc, c) => acc + (parseInt(c.value) || 0), 0) : 0;
      const nativeVisits = getMetric(item.actions, 'onsite_conversion.instagram_profile_visit');
      
      // Heurística de Atribuição Universal:
      // 1. Se tem visitas nativas, somamos aos cliques (Caso Carretel/Web)
      // 2. Se não tem, e cliques de saída são altos, subtraímos (Caso Solution/Profile)
      let totalVisitas = 0;
      if (nativeVisits > 0) {
        totalVisitas = linkClicks + nativeVisits;
      } else if (outboundClicks > (linkClicks * 0.5)) {
        totalVisitas = Math.abs(linkClicks - outboundClicks);
      } else {
        totalVisitas = linkClicks + outboundClicks;
      }

      return prisma.metricaCampanha.upsert({
        where: { campanha_id_data: { campanha_id: camp.id, data: dataInsight } },
        update: {
          impressoes: parseInt(item.impressions) || 0, alcance: parseInt(item.reach) || 0, cliques: linkClicks,
          visitas_perfil: totalVisitas, seguidores: getMetric(item.actions, 'onsite_conversion.follow') + getMetric(item.actions, 'page_like'),
          reacoes_sociais: getSocialActions(item.actions), valor_investido: parseFloat(item.spend) || 0,
          conversas_leads: getTrueLeads(item.actions), compras: getMetric(item.actions, 'purchase'), valor_compras: getMetric(item.action_values, 'purchase', true)    
        },
        create: {
          campanha_id: camp.id, data: dataInsight,
          impressoes: parseInt(item.impressions) || 0, alcance: parseInt(item.reach) || 0, cliques: linkClicks,
          visitas_perfil: totalVisitas, seguidores: getMetric(item.actions, 'onsite_conversion.follow') + getMetric(item.actions, 'page_like'),
          reacoes_sociais: getSocialActions(item.actions), valor_investido: parseFloat(item.spend) || 0,
          conversas_leads: getTrueLeads(item.actions), compras: getMetric(item.actions, 'purchase'), valor_compras: getMetric(item.action_values, 'purchase', true)    
        }
      });
    });

    // 8. Process Ad Level Insights & Creatives
    if (adInsightData.length > 0) {
      const adsListRes = await fetch(graphUrl(`${AD_ACCOUNT_ID}/ads`, { access_token: ACCESS_TOKEN, fields: 'id,creative{id}', limit: '1000' }));
      const adsListData = await adsListRes.json();
      const adToCreativeMap = new Map(adsListData.data?.map(a => [a.id, a.creative?.id]) || []);

      await batchProcess(adInsightData, 10, async (row) => {
        const camp = localCampMap.get(String(row.campaign_id));
        if (!camp) return;
        const creativeId = adToCreativeMap.get(String(row.ad_id));
        const adMeta = creativeMetaMap.get(String(creativeId)) || {};
        const highResImage = imageHashMap.get(adMeta.image_hash) || storyMetaMap.get(adMeta.effective_object_story_id) || adMeta.image_url || adMeta.thumbnail_url;

        const criativo = await prisma.criativo.upsert({      
          where: { meta_ad_id: String(row.ad_id) },
          update: { nome_anuncio: row.ad_name, url_midia: highResImage, texto_principal: adMeta.body },
          create: { meta_ad_id: String(row.ad_id), campanha_id: camp.id, nome_anuncio: row.ad_name, url_midia: highResImage, texto_principal: adMeta.body }
        });

        const dataInsight = new Date(row.date_start + 'T00:00:00.000Z');
        return prisma.metricaCriativo.upsert({
          where: { criativo_id_data: { criativo_id: criativo.id, data: dataInsight } },
          update: {
            impressoes: parseInt(row.impressions) || 0, alcance: parseInt(row.reach) || 0, cliques: parseInt(row.inline_link_clicks) || 0,
            ctr: parseFloat(row.inline_link_click_ctr) || 0, valor_investido: parseFloat(row.spend) || 0,
            leads: getTrueLeads(row.actions), compras: getMetric(row.actions, 'purchase'), reacoes_sociais: getSocialActions(row.actions)
          },
          create: {
            criativo_id: criativo.id, data: dataInsight, impressoes: parseInt(row.impressions) || 0, alcance: parseInt(row.reach) || 0,
            cliques: parseInt(row.inline_link_clicks) || 0, ctr: parseFloat(row.inline_link_click_ctr) || 0,
            valor_investido: parseFloat(row.spend) || 0, leads: getTrueLeads(row.actions), compras: getMetric(row.actions, 'purchase'), reacoes_sociais: getSocialActions(row.actions)
          }
        });
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST BulletproofSync Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
