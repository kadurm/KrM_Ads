const fs = require('fs');
const path = require('path');

// 1. Load env vars
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
  }
} catch (e) {
  console.error('Error loading env:', e.message);
}

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
  return getMetric(actions, 'post_reaction') + getMetric(actions, 'comment') + getMetric(actions, 'share');
}

async function main() {
  const clienteName = 'Solution Place';
  const since = '2026-04-01';
  const until = '2026-04-30';
  
  console.log(`🚀 Sincronizando dados históricos de Abril de 2026 para Solution Place...`);
  
  const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN_Solution || process.env.META_ACCESS_TOKEN_GLOBAL;
  const AD_ACCOUNT_ID = 'act_861875509414758';

  const dbCliente = await prisma.cliente.findFirst({
    where: { nome: { equals: clienteName, mode: 'insensitive' } }
  });

  if (!dbCliente) {
    console.error('Cliente não encontrado no banco.');
    process.exit(1);
  }

  // 1. Fetch campaigns and objectives
  const metaCampsRes = await fetch(graphUrl(`${AD_ACCOUNT_ID}/campaigns`, { access_token: ACCESS_TOKEN, fields: 'id,name,objective', limit: '1000' }));
  const metaCampsData = await metaCampsRes.json();
  const objectiveMap = new Map(metaCampsData.data?.map(c => [c.id, c.objective]) || []);

  // 2. Fetch insights
  const query = {
    access_token: ACCESS_TOKEN,
    fields: 'campaign_id,campaign_name,spend,impressions,reach,inline_link_click_ctr,clicks,inline_link_clicks,outbound_clicks,actions,action_values',
    level: 'campaign',
    time_range: JSON.stringify({ since, until }),
    time_increment: '1',
    limit: '1000'
  };

  const campaignData = await fetchMetaInsights(graphUrl(`${AD_ACCOUNT_ID}/insights`, query));
  console.log(`✅ Recuperados ${campaignData.length} dias de métricas de campanhas.`);

  // 3. Upsert campaigns in DB
  const localCampMap = new Map();
  const uniqueCampaigns = [...new Map(campaignData.map(item => [item.campaign_id, item])).values()];
  for (const item of uniqueCampaigns) {
    const camp = await prisma.campanha.upsert({
      where: { meta_id: String(item.campaign_id) },      
      update: { nome_gerado: item.campaign_name, objetivo: objectiveMap.get(item.campaign_id) || 'UNKNOWN' },
      create: { meta_id: String(item.campaign_id), nome_gerado: item.campaign_name, cliente_id: dbCliente.id, objetivo: objectiveMap.get(item.campaign_id) || 'UNKNOWN', tipo_orcamento: 'UNKNOWN' }
    });
    localCampMap.set(camp.meta_id, camp);
  }

  // 4. Save daily metrics
  let count = 0;
  for (const item of campaignData) {
    const camp = localCampMap.get(String(item.campaign_id));
    if (!camp) continue;
    const dataInsight = new Date(item.date_start + 'T00:00:00');
    const linkClicks = parseInt(item.inline_link_clicks) || 0;
    const outboundClicks = Array.isArray(item.outbound_clicks) ? item.outbound_clicks.reduce((acc, c) => acc + (parseInt(c.value) || 0), 0) : 0;
    const nativeVisits = getMetric(item.actions, 'onsite_conversion.instagram_profile_visit');
    
    let totalVisitas = nativeVisits > 0 ? (linkClicks + nativeVisits) : (outboundClicks > (linkClicks * 0.5) ? Math.abs(linkClicks - outboundClicks) : linkClicks + outboundClicks);

    await prisma.metricaCampanha.upsert({
      where: { campanha_id_data: { campanha_id: camp.id, data: dataInsight } },
      update: {
        impressoes: parseInt(item.impressions) || 0,
        alcance: parseInt(item.reach) || 0,
        cliques: linkClicks,
        visitas_perfil: totalVisitas,
        seguidores: getMetric(item.actions, 'onsite_conversion.follow') + getMetric(item.actions, 'page_like'),
        reacoes_sociais: getSocialActions(item.actions),
        valor_investido: parseFloat(item.spend) || 0,
        conversas_leads: getTrueLeads(item.actions),
        compras: getMetric(item.actions, 'purchase'),
        valor_compras: getMetric(item.action_values, 'purchase', true)    
      },
      create: {
        campanha_id: camp.id,
        data: dataInsight,
        impressoes: parseInt(item.impressions) || 0,
        alcance: parseInt(item.reach) || 0,
        cliques: linkClicks,
        visitas_perfil: totalVisitas,
        seguidores: getMetric(item.actions, 'onsite_conversion.follow') + getMetric(item.actions, 'page_like'),
        reacoes_sociais: getSocialActions(item.actions),
        valor_investido: parseFloat(item.spend) || 0,
        conversas_leads: getTrueLeads(item.actions),
        compras: getMetric(item.actions, 'purchase'),
        valor_compras: getMetric(item.action_values, 'purchase', true)    
      }
    });
    count++;
  }

  console.log(`🎉 Sincronizados ${count} registros para Solution Place em Abril.`);
  await prisma.$disconnect();
}

main();
