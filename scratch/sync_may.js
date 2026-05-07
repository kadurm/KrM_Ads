const fs = require('fs');
const path = require('path');
const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) return;
  const key = trimmed.substring(0, eqIdx).trim();
  let val = trimmed.substring(eqIdx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
  process.env[key] = val;
});
// Force direct connection (bypass PgBouncer)
process.env.DATABASE_URL = process.env.DIRECT_URL;
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function graphUrl(p, query) {
  const url = new URL(`https://graph.facebook.com/v21.0/${p}`);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });
  return url.toString();
}

function getMetric(actions, type, isValue = false) {
  if (!Array.isArray(actions)) return 0;
  const matches = actions.filter(a => a.action_type === type);
  return matches.reduce((acc, a) => acc + (isValue ? parseFloat(a.value || 0) : parseInt(a.value || 0, 10)), 0);
}
function getTrueLeads(actions) {
  if (!Array.isArray(actions)) return 0;
  const msgReply = getMetric(actions, 'onsite_conversion.messaging_first_reply');
  const msgStarted = getMetric(actions, 'onsite_conversion.messaging_conversation_started_7d');
  const standardLead = getMetric(actions, 'lead');
  const leadGen = getMetric(actions, 'onsite_conversion.lead_grouped');
  const customContact = getMetric(actions, 'offsite_conversion.fb_pixel_custom');
  const fbContact = getMetric(actions, 'contact');
  return Math.max(msgReply, msgStarted) + Math.max(standardLead, leadGen) + customContact + fbContact;
}
function getSocialActions(actions) {
  if (!Array.isArray(actions)) return 0;
  return getMetric(actions, 'post_reaction') + getMetric(actions, 'comment') +
    getMetric(actions, 'onsite_conversion.post_save') + getMetric(actions, 'post_save') +
    getMetric(actions, 'onsite_conversion.post_share') + getMetric(actions, 'share');
}

async function syncCliente(clienteNome, since, until) {
  console.log(`\n=== SYNC: ${clienteNome} (${since} → ${until}) ===`);
  
  const slug = clienteNome.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '');
  const dbCliente = await prisma.cliente.findFirst({
    where: { OR: [{ nome: { equals: clienteNome, mode: 'insensitive' } }, { slug: { equals: slug, mode: 'insensitive' } }] }
  });
  if (!dbCliente) { console.log('❌ Cliente não encontrado no banco'); return; }

  const ACCESS_TOKEN = process.env[`META_ACCESS_TOKEN_${slug.toUpperCase()}`] || process.env[`META_ACCESS_TOKEN_${slug}`] || process.env.META_ACCESS_TOKEN_GLOBAL || dbCliente.meta_access_token;
  const rawId = process.env[`META_AD_ACCOUNT_ID_${slug.toUpperCase()}`] || process.env[`META_AD_ACCOUNT_ID_${slug}`] || dbCliente.meta_ads_account_id;
  const AD_ACCOUNT_ID = rawId?.startsWith('act_') ? rawId : `act_${rawId}`;

  console.log(`Token: ...${ACCESS_TOKEN?.slice(-20)}`);
  console.log(`Account: ${AD_ACCOUNT_ID}`);

  const commonQuery = { access_token: ACCESS_TOKEN, time_range: JSON.stringify({ since, until }), limit: '1000' };

  // Fetch data from Meta
  const [metaCampsRes, campaignRes, adInsightRes, adsMetaRes] = await Promise.all([
    fetch(graphUrl(`${AD_ACCOUNT_ID}/campaigns`, { access_token: ACCESS_TOKEN, fields: 'id,name,objective', limit: '1000' })),
    fetch(graphUrl(`${AD_ACCOUNT_ID}/insights`, { ...commonQuery, fields: 'campaign_id,campaign_name,spend,impressions,reach,inline_link_click_ctr,clicks,inline_link_clicks,actions,action_values', level: 'campaign', time_increment: '1' })),
    fetch(graphUrl(`${AD_ACCOUNT_ID}/insights`, { ...commonQuery, fields: 'ad_id,ad_name,campaign_id,spend,impressions,reach,inline_link_click_ctr,clicks,inline_link_clicks,actions,action_values', level: 'ad', time_increment: '1' })),
    fetch(graphUrl(`${AD_ACCOUNT_ID}/adcreatives`, { access_token: ACCESS_TOKEN, fields: 'id,image_url,thumbnail_url,image_hash,body,effective_object_story_id', thumbnail_width: 800, thumbnail_height: 800, limit: '1000' }))
  ]);

  const [metaCampsData, campaignData, adInsightData, adsMetaData] = await Promise.all([metaCampsRes.json(), campaignRes.json(), adInsightRes.json(), adsMetaRes.json()]);

  if (campaignData.error) { console.log('❌ Erro Meta:', campaignData.error.message); return; }

  const objectiveMap = new Map(metaCampsData.data?.map(c => [c.id, c.objective]) || []);
  const creativeMetaMap = new Map(adsMetaData.data?.map(m => [String(m.id), m]) || []);

  // Story images
  const storyIds = adsMetaData.data?.map(m => m.effective_object_story_id).filter(id => !!id) || [];
  const storyMetaMap = new Map();
  for (let i = 0; i < storyIds.length; i += 50) {
    try {
      const chunk = storyIds.slice(i, i + 50);
      const res = await fetch(graphUrl('', { ids: chunk.join(','), fields: 'id,full_picture', access_token: ACCESS_TOKEN }));
      const data = await res.json();
      if (!data.error) Object.values(data).forEach(post => storyMetaMap.set(post.id, post.full_picture));
    } catch (e) {}
  }

  // Image hashes
  const imageHashMap = new Map();
  const uniqueHashes = [...new Set(adsMetaData.data?.map(m => m.image_hash).filter(h => !!h) || [])];
  for (let i = 0; i < uniqueHashes.length; i += 50) {
    try {
      const chunk = uniqueHashes.slice(i, i + 50);
      const res = await fetch(graphUrl(`${AD_ACCOUNT_ID}/adimages`, { access_token: ACCESS_TOKEN, hashes: JSON.stringify(chunk), fields: 'url,permalink_url,hash' }));
      const data = await res.json();
      if (data.data) data.data.forEach(img => { const u = img.url || img.permalink_url; if (u) imageHashMap.set(img.hash, u); });
    } catch (e) {}
  }

  // Upsert campaigns + metrics
  const localCampMap = new Map((await prisma.campanha.findMany({ where: { cliente_id: dbCliente.id } })).map(c => [c.meta_id, c]));
  let campCount = 0;
  for (const item of (campaignData.data || [])) {
    let camp = localCampMap.get(String(item.campaign_id));
    if (!camp) {
      camp = await prisma.campanha.upsert({
        where: { meta_id: String(item.campaign_id) },
        update: { nome_gerado: item.campaign_name, objetivo: objectiveMap.get(item.campaign_id) || 'UNKNOWN' },
        create: { meta_id: String(item.campaign_id), nome_gerado: item.campaign_name, cliente_id: dbCliente.id, objetivo: objectiveMap.get(item.campaign_id) || 'UNKNOWN', tipo_orcamento: 'UNKNOWN' }
      });
      localCampMap.set(camp.meta_id, camp);
    }
    const dataInsight = new Date(item.date_start + 'T00:00:00.000Z');
    await prisma.metricaCampanha.upsert({
      where: { campanha_id_data: { campanha_id: camp.id, data: dataInsight } },
      update: {
        impressoes: parseInt(item.impressions) || 0, alcance: parseInt(item.reach) || 0,
        cliques: parseInt(item.clicks) || 0,
        visitas_perfil: getMetric(item.actions, 'onsite_conversion.instagram_profile_visit') || parseInt(item.inline_link_clicks) || 0,
        seguidores: getMetric(item.actions, 'onsite_conversion.follow') + getMetric(item.actions, 'page_like'),
        reacoes_sociais: getSocialActions(item.actions),
        valor_investido: parseFloat(item.spend) || 0, conversas_leads: getTrueLeads(item.actions),
        compras: getMetric(item.actions, 'purchase'), valor_compras: getMetric(item.action_values, 'purchase', true)
      },
      create: {
        campanha_id: camp.id, data: dataInsight,
        impressoes: parseInt(item.impressions) || 0, alcance: parseInt(item.reach) || 0,
        cliques: parseInt(item.clicks) || 0,
        visitas_perfil: getMetric(item.actions, 'onsite_conversion.instagram_profile_visit') || parseInt(item.inline_link_clicks) || 0,
        seguidores: getMetric(item.actions, 'onsite_conversion.follow') + getMetric(item.actions, 'page_like'),
        reacoes_sociais: getSocialActions(item.actions),
        valor_investido: parseFloat(item.spend) || 0, conversas_leads: getTrueLeads(item.actions),
        compras: getMetric(item.actions, 'purchase'), valor_compras: getMetric(item.action_values, 'purchase', true)
      }
    });
    campCount++;
  }
  console.log(`✅ ${campCount} registros de campanha sincronizados`);

  // Upsert ad creatives + metrics
  if (adInsightData.data) {
    const adsListRes = await fetch(graphUrl(`${AD_ACCOUNT_ID}/ads`, { access_token: ACCESS_TOKEN, fields: 'id,creative{id}', limit: '1000' }));
    const adsListData = await adsListRes.json();
    const adToCreativeMap = new Map(adsListData.data?.map(a => [a.id, a.creative?.id]) || []);
    
    let adCount = 0;
    for (const row of adInsightData.data) {
      const camp = localCampMap.get(String(row.campaign_id));
      if (!camp) continue;
      const creativeId = adToCreativeMap.get(String(row.ad_id));
      const adMeta = creativeMetaMap.get(String(creativeId)) || {};
      const highResImage = imageHashMap.get(adMeta.image_hash) || storyMetaMap.get(adMeta.effective_object_story_id) || adMeta.image_url || adMeta.thumbnail_url;

      const criativo = await prisma.criativo.upsert({
        where: { meta_ad_id: String(row.ad_id) },
        update: { nome_anuncio: row.ad_name, url_midia: highResImage, texto_principal: adMeta.body },
        create: { meta_ad_id: String(row.ad_id), campanha_id: camp.id, nome_anuncio: row.ad_name, url_midia: highResImage, texto_principal: adMeta.body }
      });

      const dataInsight = new Date(row.date_start + 'T00:00:00.000Z');
      await prisma.metricaCriativo.upsert({
        where: { criativo_id_data: { criativo_id: criativo.id, data: dataInsight } },
        update: { impressoes: parseInt(row.impressions) || 0, alcance: parseInt(row.reach) || 0, cliques: parseInt(row.clicks) || 0, ctr: parseFloat(row.inline_link_click_ctr) || 0, valor_investido: parseFloat(row.spend) || 0, leads: getTrueLeads(row.actions), compras: getMetric(row.actions, 'purchase'), reacoes_sociais: getSocialActions(row.actions) },
        create: { criativo_id: criativo.id, data: dataInsight, impressoes: parseInt(row.impressions) || 0, alcance: parseInt(row.reach) || 0, cliques: parseInt(row.clicks) || 0, ctr: parseFloat(row.inline_link_click_ctr) || 0, valor_investido: parseFloat(row.spend) || 0, leads: getTrueLeads(row.actions), compras: getMetric(row.actions, 'purchase'), reacoes_sociais: getSocialActions(row.actions) }
      });
      adCount++;
    }
    console.log(`✅ ${adCount} registros de criativos sincronizados`);
  }
}

async function main() {
  const clientes = await prisma.cliente.findMany({ select: { nome: true } });
  console.log('Clientes no sistema:', clientes.map(c => c.nome).join(', '));
  
  for (const c of clientes) {
    await syncCliente(c.nome, '2026-05-01', '2026-05-07');
  }

  // Verificação final
  const countMaio = await prisma.metricaCampanha.count({
    where: { data: { gte: new Date('2026-05-01T00:00:00.000Z'), lte: new Date('2026-05-31T23:59:59.999Z') } }
  });
  console.log(`\n=== RESULTADO FINAL ===`);
  console.log(`Métricas de Maio/2026 no banco: ${countMaio} registros`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
