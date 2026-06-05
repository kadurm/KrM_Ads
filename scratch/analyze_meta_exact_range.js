const fs = require('fs');
const path = require('path');

const ACCESS_TOKEN = "EAAYYES5B9UgBRQaRlKc2t7qZB27kqokZBP1EKmFI6Hub7ZBNdZBGN3JoSP6dpZBQ0mufMKo71VZBgh93OdP0lalt1xZCXO8HHNc5avK3p0KhqzXgLv5cNLcXmVZBOZA72etylag2GJRYxZBxe9Sk96YYCGKi1I0wX1NDaEedl70vzyqdSO29B58bxX6rwsEnutt0PcnOa4QSnBYKaB";
const AD_ACCOUNT_ID = 'act_861875509414758';

function graphUrl(path, query) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });
  return url.toString();
}

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

async function main() {
  const time_range = { since: '2026-05-05', until: '2026-06-03' };
  console.log(`Buscando dados da API da Meta de ${time_range.since} até ${time_range.until}...`);

  const commonQuery = { access_token: ACCESS_TOKEN, limit: '1000' };
  commonQuery.time_range = JSON.stringify(time_range);

  // 1. Buscar Campanhas na Meta
  console.log(`Buscando campanhas...`);
  const metaCampsRes = await fetch(graphUrl(`${AD_ACCOUNT_ID}/campaigns`, { access_token: ACCESS_TOKEN, fields: 'id,name,objective', limit: '1000' }));
  const metaCampsData = await metaCampsRes.json();
  const objectiveMap = new Map(metaCampsData.data?.map(c => [c.id, c.objective]) || []);

  // 2. Buscar Métricas Agregadas de Campanha
  console.log(`Buscando métricas de campanhas...`);
  const campaignFields = 'campaign_id,campaign_name,spend,impressions,reach,clicks,inline_link_clicks,outbound_clicks,actions,action_values';
  const campaignData = await fetchMetaInsights(graphUrl(`${AD_ACCOUNT_ID}/insights`, { ...commonQuery, fields: campaignFields, level: 'campaign' }));

  // 3. Buscar Métricas de Anúncio
  console.log(`Buscando métricas de criativos...`);
  const adFields = 'ad_id,ad_name,campaign_id,spend,impressions,clicks,inline_link_clicks,actions';
  const adData = await fetchMetaInsights(graphUrl(`${AD_ACCOUNT_ID}/insights`, { ...commonQuery, fields: adFields, level: 'ad' }));

  // 4. Buscar Metadados de Criativos
  console.log(`Buscando corpos e mídias de criativos...`);
  const adsMetaRes = await fetch(graphUrl(`${AD_ACCOUNT_ID}/adcreatives`, { access_token: ACCESS_TOKEN, fields: 'id,body,image_url,thumbnail_url,image_hash,effective_object_story_id', thumbnail_width: 800, thumbnail_height: 800, limit: '1000' }));
  const adsMetaData = await adsMetaRes.json();
  const creativeMetaMap = new Map(adsMetaData.data?.map(m => [String(m.id), m]) || []);

  // Resolvendo imagens de posts
  const storyIds = adsMetaData.data?.map(m => m.effective_object_story_id).filter(id => !!id) || [];
  const storyMetaMap = new Map();
  if (storyIds.length > 0) {
     for (let i = 0; i < storyIds.length; i += 50) {
       const chunk = storyIds.slice(i, i + 50);
       const res = await fetch(graphUrl(``, { ids: chunk.join(','), fields: 'id,full_picture', access_token: ACCESS_TOKEN }));
       const data = await res.json();
       Object.values(data).forEach(post => {
         if (post.full_picture) storyMetaMap.set(post.id, post.full_picture);
       });
     }
  }

  // Resolvendo imagens por Hash
  const imageHashMap = new Map();
  const uniqueHashes = [...new Set(adsMetaData.data?.map(m => m.image_hash).filter(h => !!h) || [])];
  if (uniqueHashes.length > 0) {
     for (let i = 0; i < uniqueHashes.length; i += 50) {
       const chunk = uniqueHashes.slice(i, i + 50);
       const res = await fetch(graphUrl(`${AD_ACCOUNT_ID}/adimages`, { access_token: ACCESS_TOKEN, hashes: JSON.stringify(chunk), fields: 'url,permalink_url,hash' }));
       const data = await res.json();
       if (data.data) data.data.forEach(img => {
         const bestUrl = img.url || img.permalink_url;
         if (bestUrl) imageHashMap.set(img.hash, bestUrl);
       });
     }
  }

  // Relacionamento de AD ID com Creative ID
  const adsListRes = await fetch(graphUrl(`${AD_ACCOUNT_ID}/ads`, { access_token: ACCESS_TOKEN, fields: 'id,creative{id}', limit: '1000' }));
  const adsListData = await adsListRes.json();
  const adToCreativeMap = new Map(adsListData.data?.map(a => [a.id, a.creative?.id]) || []);

  let out = '';
  function log(msg) {
    out += msg + '\n';
  }

  log(`======================================================================`);
  log(`ANALISANDO DADOS REAIS DA SOLUTION PLACE (DIRETAMENTE DA META API)`);
  log(`Período analisado: 2026-05-05 a 2026-06-03 (Últimos 30 dias fechados)`);
  log(`======================================================================`);

  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalLeads = 0;

  campaignData.forEach(c => {
    totalSpend += parseFloat(c.spend || 0);
    totalImpressions += parseInt(c.impressions || 0);
    totalClicks += parseInt(c.clicks || 0);
    totalLeads += getTrueLeads(c.actions);
  });

  log(`\n--- RESUMO CONSOLIDADO REAL DA CONTA ---`);
  log(`Total Investido: R$ ${totalSpend.toFixed(2)}`);
  log(`Total Impressões: ${totalImpressions}`);
  log(`Total Cliques: ${totalClicks}`);
  log(`CTR Médio da Conta: ${totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) + '%' : '0%'}`);
  log(`CPC Médio da Conta: ${totalClicks > 0 ? 'R$ ' + (totalSpend / totalClicks).toFixed(2) : 'N/A'}`);
  log(`Total Leads (Conversas Iniciadas/True Leads): ${totalLeads}`);
  log(`CPL Médio da Conta (Leads de Conversa): ${totalLeads > 0 ? 'R$ ' + (totalSpend / totalLeads).toFixed(2) : 'N/A'}`);

  log(`\n--- PERFORMANCE REAL POR CAMPANHA ---`);
  campaignData.sort((a, b) => parseFloat(b.spend) - parseFloat(a.spend)).forEach((camp, index) => {
    const spend = parseFloat(camp.spend || 0);
    const impressions = parseInt(camp.impressions || 0);
    const clicks = parseInt(camp.clicks || 0);
    const leads = getTrueLeads(camp.actions);
    const objective = objectiveMap.get(camp.campaign_id) || 'UNKNOWN';

    const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) + '%' : '0%';
    const cpl = leads > 0 ? 'R$ ' + (spend / leads).toFixed(2) : 'N/A';
    const cpc = clicks > 0 ? 'R$ ' + (spend / clicks).toFixed(2) : 'N/A';
    
    // Visitas
    const linkClicks = parseInt(camp.inline_link_clicks) || 0;
    const outboundClicks = Array.isArray(camp.outbound_clicks) ? camp.outbound_clicks.reduce((acc, c) => acc + (parseInt(c.value) || 0), 0) : 0;
    const nativeVisits = getMetric(camp.actions, 'onsite_conversion.instagram_profile_visit');
    let totalVisitas = 0;
    if (nativeVisits > 0) {
      totalVisitas = linkClicks + nativeVisits;
    } else if (outboundClicks > (linkClicks * 0.5)) {
      totalVisitas = Math.abs(linkClicks - outboundClicks);
    } else {
      totalVisitas = linkClicks + outboundClicks;
    }

    log(`\n${index + 1}. [${objective}] ${camp.campaign_name}`);
    log(`   Meta ID: ${camp.campaign_id}`);
    log(`   Investido: R$ ${spend.toFixed(2)}`);
    log(`   Impressões: ${impressions} | Cliques: ${clicks} | CTR: ${ctr}`);
    log(`   Leads: ${leads} | CPL: ${cpl} | CPC: ${cpc}`);
    log(`   Visitas Perfil (Atribuição): ${totalVisitas}`);

    // Criativos desta campanha
    log(`   Criativos desta campanha:`);
    const campAds = adData.filter(ad => ad.campaign_id === camp.campaign_id);
    
    campAds.sort((a, b) => parseFloat(b.spend) - parseFloat(a.spend)).forEach(ad => {
      const adSpend = parseFloat(ad.spend || 0);
      const adImpressions = parseInt(ad.impressions || 0);
      const adClicks = parseInt(ad.clicks || 0);
      const adLeads = getTrueLeads(ad.actions);
      
      const adCtr = adImpressions > 0 ? ((adClicks / adImpressions) * 100).toFixed(2) + '%' : '0%';
      const adCpl = adLeads > 0 ? 'R$ ' + (adSpend / adLeads).toFixed(2) : 'N/A';

      const creativeId = adToCreativeMap.get(ad.ad_id);
      const adMeta = creativeMetaMap.get(String(creativeId)) || {};
      
      const highResImage = imageHashMap.get(adMeta.image_hash) 
                        || storyMetaMap.get(adMeta.effective_object_story_id) 
                        || adMeta.image_url 
                        || adMeta.thumbnail_url;

      log(`     * Anúncio: ${ad.ad_name} (ID: ${ad.ad_id})`);
      log(`       - Investimento: R$ ${adSpend.toFixed(2)} | Cliques: ${adClicks} | Leads: ${adLeads} | CPL: ${adCpl} | CTR: ${adCtr}`);
      if (highResImage) {
        log(`       - Mídia: ${highResImage}`);
      }
      if (adMeta.body) {
        log(`       - Copy: "${adMeta.body.substring(0, 120).replace(/\n/g, ' ')}..."`);
      }
    });
  });

  log(`\n======================================================================`);
  log(`RANKING GERAL DE CRIATIVOS POR NÚMERO DE LEADS (2026-05-05 A 2026-06-03)`);
  log(`======================================================================`);
  
  const allAdsProcessed = [];
  adData.forEach(ad => {
    const adSpend = parseFloat(ad.spend || 0);
    const adImpressions = parseInt(ad.impressions || 0);
    const adClicks = parseInt(ad.clicks || 0);
    const adLeads = getTrueLeads(ad.actions);
    
    const creativeId = adToCreativeMap.get(ad.ad_id);
    const adMeta = creativeMetaMap.get(String(creativeId)) || {};
    
    const highResImage = imageHashMap.get(adMeta.image_hash) 
                      || storyMetaMap.get(adMeta.effective_object_story_id) 
                      || adMeta.image_url 
                      || adMeta.thumbnail_url;

    const campName = campaignData.find(c => c.campaign_id === ad.campaign_id)?.campaign_name || 'UNKNOWN';

    allAdsProcessed.push({
      name: ad.ad_name,
      ad_id: ad.ad_id,
      campName,
      spend: adSpend,
      impressions: adImpressions,
      clicks: adClicks,
      leads: adLeads,
      url_midia: highResImage,
      body: adMeta.body
    });
  });

  allAdsProcessed.sort((a, b) => b.leads - a.leads || b.spend - a.spend);
  allAdsProcessed.slice(0, 15).forEach((cr, index) => {
    const cCtr = cr.impressions > 0 ? ((cr.clicks / cr.impressions) * 100).toFixed(2) + '%' : '0%';
    const cCpl = cr.leads > 0 ? 'R$ ' + (cr.spend / cr.leads).toFixed(2) : 'N/A';
    log(`${index + 1}. ${cr.name} [Campanha: ${cr.campName}]`);
    log(`   ID Meta: ${cr.ad_id}`);
    log(`   Performance: Leads: ${cr.leads} | Investido: R$ ${cr.spend.toFixed(2)} | CPL: ${cCpl} | CTR: ${cCtr} | Cliques: ${cr.clicks}`);
    if (cr.url_midia) {
      log(`   Mídia: ${cr.url_midia}`);
    }
    if (cr.body) {
      log(`   Copy: "${cr.body.substring(0, 150).replace(/\n/g, ' ')}..."`);
    }
    log('');
  });

  const outputPath = path.join(__dirname, 'solution_exact_analysis_full.txt');
  fs.writeFileSync(outputPath, out, 'utf-8');
  console.log(`Análise concluída com sucesso! Escrita em: ${outputPath}`);
}

main().catch(err => console.error(err));
