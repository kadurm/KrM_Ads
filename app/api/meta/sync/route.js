import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Maximiza a resolução de URLs do fbcdn.net para 800px */
const maximizeResolution = (url) => {
  if (!url || !url.includes('fbcdn.net')) return url;
  return url
    .replace(/_p\d+x\d+_q/g, '_p800x800_q')
    .replace(/_s\d+x\d+_q/g, '_s800x800_q')
    .replace(/stp=.*?_p\d+x\d+_q/g, (match) => match.replace(/p\d+x\d+/, 'p800x800'))
    .replace(/stp=.*?_s\d+x\d+_q/g, (match) => match.replace(/s\d+x\d+/, 's800x800'));
};

function graphUrl(path, query) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });
  return url.toString();
}

function getMetric(actions, type, isValue = false) {
  if (!actions || !Array.isArray(actions)) return 0;
  const action = actions.find(a => a.action_type === type);
  if (!action) return 0;
  return isValue ? parseFloat(action.value || 0) : parseInt(action.value || 0);
}

function getTrueLeads(actions) {
  if (!actions || !Array.isArray(actions)) return 0;
  return getMetric(actions, 'onsite_conversion.messaging_conversation_started_7d') + 
         getMetric(actions, 'lead');
}

async function batchProcess(items, batchSize, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    results.push(...(await Promise.all(batch.map(fn))));
  }
  return results;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const cliente = searchParams.get('cliente');
    const since = searchParams.get('since');
    const until = searchParams.get('until');

    if (!cliente) return NextResponse.json({ success: false, error: "Cliente não fornecido" }, { status: 400 });

    const dbCliente = await prisma.cliente.findFirst({ where: { nome: cliente } });
    if (!dbCliente) return NextResponse.json({ success: false, error: "Cliente não encontrado" }, { status: 404 });

    const dateSince = new Date(since + 'T00:00:00.000Z');
    const dateUntil = new Date(until + 'T00:00:00.000Z');

    const [metricsRaw, criativosRaw] = await Promise.all([
      prisma.metricaCampanha.findMany({
        where: { campanha: { cliente_id: dbCliente.id }, data: { gte: dateSince, lte: dateUntil } },
        include: { campanha: true }
      }),
      prisma.criativo.findMany({
        where: { campanha: { cliente_id: dbCliente.id } },
        include: { metricas: { where: { data: { gte: dateSince, lte: dateUntil } } } }
      })
    ]);

    const dailyMetrics = {};
    const aggregated = {};
    metricsRaw.forEach(m => {
      const day = m.data.toISOString().split('T')[0];
      if (!dailyMetrics[day]) dailyMetrics[day] = { date: day, spend: 0, leads: 0, impressions: 0 };
      dailyMetrics[day].spend += m.valor_investido;
      dailyMetrics[day].leads += m.conversas_leads;
      dailyMetrics[day].impressions += m.impressoes;

      const campId = m.campanha.meta_id;
      if (!aggregated[campId]) aggregated[campId] = { ...m, valor_investido: 0, impressoes: 0, alcance: 0, cliques: 0, visitas_perfil: 0, seguidores: 0, conversas_leads: 0, compras: 0, valor_compras: 0 };
      aggregated[campId].valor_investido += m.valor_investido;
      aggregated[campId].impressoes += m.impressoes;
      aggregated[campId].alcance += m.alcance;
      aggregated[campId].cliques += m.cliques;
      aggregated[campId].visitas_perfil += m.visitas_perfil;
      aggregated[campId].seguidores += m.seguidores;
      aggregated[campId].conversas_leads += m.conversas_leads;
      aggregated[campId].compras += m.compras;
      aggregated[campId].valor_compras += m.valor_compras;
    });

    const criativos = criativosRaw.map(c => {
      const stats = c.metricas.reduce((acc, curr) => ({
        impressoes: acc.impressoes + curr.impressoes,
        valor_investido: acc.valor_investido + curr.valor_investido,
        leads: acc.leads + curr.leads,
        cliques: acc.cliques + curr.cliques
      }), { impressoes: 0, valor_investido: 0, leads: 0, cliques: 0 });

      if (stats.impressoes === 0 && stats.valor_investido === 0) return null;

      return {
        id: c.id,
        nome_anuncio: c.nome_anuncio,
        url_midia: c.url_midia,
        ...stats,
        ctr: stats.impressoes > 0 ? (stats.cliques / stats.impressoes * 100) : 0
      };
    }).filter(Boolean).sort((a, b) => b.leads - a.leads || b.valor_investido - a.valor_investido);

    return NextResponse.json({ 
      success: true, 
      metrics: Object.values(aggregated).map(m => ({ ...m, cpr: m.conversas_leads > 0 ? m.valor_investido / m.conversas_leads : 0 })), 
      criativos,
      dailyMetrics: Object.values(dailyMetrics).sort((a, b) => a.date.localeCompare(b.date))
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { since, until, cliente } = await request.json();
    if (!cliente) return NextResponse.json({ success: false, error: "Cliente não fornecido" }, { status: 400 });

    const shortName = cliente.split(' ')[0];
    const rawAccountId = process.env[`META_AD_ACCOUNT_ID_${shortName}`];
    const ACCESS_TOKEN = process.env[`META_ACCESS_TOKEN_${shortName}`];
    if (!rawAccountId || !ACCESS_TOKEN) return NextResponse.json({ success: false, error: "Configuração ausente" }, { status: 500 });

    const AD_ACCOUNT_ID = rawAccountId.startsWith('act_') ? rawAccountId : `act_${rawAccountId}`;
    const dbCliente = await prisma.cliente.findFirst({ where: { nome: cliente } });
    if (!dbCliente) return NextResponse.json({ success: false, error: "Cliente não encontrado" }, { status: 404 });

    const commonQuery = { access_token: ACCESS_TOKEN, limit: '1000' };
    if (since === until && since === new Date().toISOString().split('T')[0]) {
      commonQuery.date_preset = 'today';
    } else {
      commonQuery.time_range = JSON.stringify({ since, until });
    }

    const [metaCampsRes, campaignRes, adInsightRes] = await Promise.all([
      fetch(graphUrl(`${AD_ACCOUNT_ID}/campaigns`, { access_token: ACCESS_TOKEN, fields: 'id,name,objective', limit: '1000' })),
      fetch(graphUrl(`${AD_ACCOUNT_ID}/insights`, { ...commonQuery, fields: 'campaign_id,campaign_name,spend,impressions,reach,inline_link_click_ctr,clicks,inline_link_clicks,actions,action_values', level: 'campaign', time_increment: '1' })),
      fetch(graphUrl(`${AD_ACCOUNT_ID}/insights`, { ...commonQuery, fields: 'ad_id,ad_name,campaign_id,spend,impressions,reach,inline_link_click_ctr,clicks,inline_link_clicks,actions,action_values', level: 'ad', time_increment: '1' }))
    ]);

    const [metaCamps, campaignData, adInsightData] = await Promise.all([metaCampsRes.json(), campaignRes.json(), adInsightRes.json()]);
    if (campaignData.error) throw new Error(campaignData.error.message);

    const objectiveMap = new Map(metaCamps.data?.map(c => [c.id, c.objective]) || []);
    
    // Fetch Creatives (Inclui story_id para HD Supremo)
    const adIds = [...new Set(adInsightData.data?.map(i => i.ad_id).filter(id => !!id) || [])];
    const creativeMap = new Map();
    const hashes = new Set();
    const storyIds = new Set();

    if (adIds.length > 0) {
      for (let i = 0; i < adIds.length; i += 50) {
        const chunk = adIds.slice(i, i + 50);
        const res = await fetch(graphUrl(``, { ids: chunk.join(','), fields: 'id,creative{id,image_url,thumbnail_url,image_hash,effective_object_story_id,body}', access_token: ACCESS_TOKEN }));
        const data = await res.json();
        Object.entries(data).forEach(([adId, adInfo]) => {
          if (adInfo.creative) {
            creativeMap.set(adId, {
              imageUrl: adInfo.creative.image_url,
              thumbUrl: adInfo.creative.thumbnail_url,
              body: adInfo.creative.body,
              hash: adInfo.creative.image_hash,
              storyId: adInfo.creative.effective_object_story_id
            });
            if (adInfo.creative.image_hash) hashes.add(adInfo.creative.image_hash);
            if (adInfo.creative.effective_object_story_id) storyIds.add(adInfo.creative.effective_object_story_id);
          }
        });
      }
    }

    // Lookup 1: Biblioteca de Imagens (O que faz o AD[02/03/26] funcionar)
    const nativeUrlMap = new Map();
    if (hashes.size > 0) {
      const hashList = Array.from(hashes);
      for (let i = 0; i < hashList.length; i += 50) {
        const chunk = hashList.slice(i, i + 50);
        const res = await fetch(graphUrl(`${AD_ACCOUNT_ID}/adimages`, { access_token: ACCESS_TOKEN, hashes: JSON.stringify(chunk), fields: 'url,hash' }));
        const data = await res.json();
        if (data.data) data.data.forEach(img => { if (img.url) nativeUrlMap.set(img.hash, img.url); });
      }
    }

    // Lookup 2: Story Posts (HD para Engagement/Videos)
    const storyMetaMap = new Map();
    if (storyIds.size > 0) {
      const storyList = Array.from(storyIds);
      for (let i = 0; i < storyList.length; i += 50) {
        const chunk = storyList.slice(i, i + 50);
        const res = await fetch(graphUrl(``, { ids: chunk.join(','), fields: 'id,full_picture', access_token: ACCESS_TOKEN }));
        const data = await res.json();
        Object.values(data).forEach(post => { if (post.full_picture) storyMetaMap.set(post.id, post.full_picture); });
      }
    }

    // Process Campaigns
    const localCampMap = new Map((await prisma.campanha.findMany({ where: { cliente_id: dbCliente.id } })).map(c => [c.meta_id, c]));
    await batchProcess(campaignData.data || [], 10, async (item) => {
      let camp = localCampMap.get(item.campaign_id);
      if (!camp) {
        camp = await prisma.campanha.upsert({
          where: { meta_id: item.campaign_id },
          update: { nome_gerado: item.campaign_name, objetivo: objectiveMap.get(item.campaign_id) || 'UNKNOWN' },
          create: { meta_id: item.campaign_id, nome_gerado: item.campaign_name, cliente_id: dbCliente.id, objetivo: objectiveMap.get(item.campaign_id) || 'UNKNOWN', tipo_orcamento: 'UNKNOWN' }
        });
        localCampMap.set(camp.meta_id, camp);
      }
      const dataInsight = new Date(item.date_start + 'T00:00:00.000Z');
      return prisma.metricaCampanha.upsert({
        where: { campanha_id_data: { campanha_id: camp.id, data: dataInsight } },
        update: {
          impressoes: parseInt(item.impressions) || 0, alcance: parseInt(item.reach) || 0, cliques: parseInt(item.clicks) || 0, 
          visitas_perfil: getMetric(item.actions, 'onsite_conversion.instagram_profile_visit') || parseInt(item.inline_link_clicks) || 0, 
          seguidores: getMetric(item.actions, 'onsite_conversion.follow') + getMetric(item.actions, 'page_like'),
          valor_investido: parseFloat(item.spend) || 0, conversas_leads: getTrueLeads(item.actions),
          compras: getMetric(item.actions, 'purchase'), valor_compras: getMetric(item.action_values, 'purchase', true)
        },
        create: {
          campanha_id: camp.id, data: dataInsight,
          impressoes: parseInt(item.impressions) || 0, alcance: parseInt(item.reach) || 0, cliques: parseInt(item.clicks) || 0, 
          visitas_perfil: getMetric(item.actions, 'onsite_conversion.instagram_profile_visit') || parseInt(item.inline_link_clicks) || 0, 
          seguidores: getMetric(item.actions, 'onsite_conversion.follow') + getMetric(item.actions, 'page_like'),
          valor_investido: parseFloat(item.spend) || 0, conversas_leads: getTrueLeads(item.actions),
          compras: getMetric(item.actions, 'purchase'), valor_compras: getMetric(item.action_values, 'purchase', true)
        }
      });
    });

    // Process Creatives (Hierarquia Inteligente de Imagem)
    if (adInsightData.data) {
      await batchProcess(adInsightData.data, 10, async (row) => {
        const camp = localCampMap.get(row.campaign_id);
        if (!camp) return;

        const info = creativeMap.get(row.ad_id) || {};
        
        // HIERARQUIA DE QUALIDADE:
        // 1. Hash da Biblioteca (Scontent nativo HD)
        // 2. Story ID (Full Picture do post original)
        // 3. Image URL Maximizada (800px)
        // 4. Thumbnail URL Maximizada (800px)
        const finalUrl = (info.hash && nativeUrlMap.get(info.hash)) || 
                         (info.storyId && storyMetaMap.get(info.storyId)) || 
                         maximizeResolution(info.imageUrl) || 
                         maximizeResolution(info.thumbUrl) || 
                         null;

        const criativo = await prisma.criativo.upsert({
          where: { meta_ad_id: row.ad_id },
          update: { nome_anuncio: row.ad_name, url_midia: finalUrl, texto_principal: info.body },
          create: { meta_ad_id: row.ad_id, campanha_id: camp.id, nome_anuncio: row.ad_name, url_midia: finalUrl, texto_principal: info.body }
        });

        const dataInsight = new Date(row.date_start + 'T00:00:00.000Z');
        return prisma.metricaCriativo.upsert({
          where: { criativo_id_data: { criativo_id: criativo.id, data: dataInsight } },
          update: { 
            impressoes: parseInt(row.impressions) || 0, alcance: parseInt(row.reach) || 0, cliques: parseInt(row.clicks) || 0, 
            ctr: parseFloat(row.inline_link_click_ctr) || 0, valor_investido: parseFloat(row.spend) || 0, 
            leads: getTrueLeads(row.actions), compras: getMetric(row.actions, 'purchase') 
          },
          create: { 
            criativo_id: criativo.id, data: dataInsight, impressoes: parseInt(row.impressions) || 0, alcance: parseInt(row.reach) || 0, 
            cliques: parseInt(row.clicks) || 0, ctr: parseFloat(row.inline_link_click_ctr) || 0, 
            valor_investido: parseFloat(row.spend) || 0, leads: getTrueLeads(row.actions), compras: getMetric(row.actions, 'purchase') 
          }
        });
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sync Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
