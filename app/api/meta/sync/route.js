import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function graphUrl(path, query) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });
  return url.toString();
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
  // Foca na métrica de conversa iniciada padrão da Meta (First Reply)
  const msgReply = getMetric(actions, 'onsite_conversion.messaging_first_reply');
  const msgStarted = getMetric(actions, 'onsite_conversion.messaging_conversation_started_7d');
  const standardLead = getMetric(actions, 'lead');
  const leadGen = getMetric(actions, 'onsite_conversion.lead_grouped');
  
  // Retorna o valor de mensagens (usando o maior entre reply e started para evitar duplicidade interna) + leads de formulário
  return Math.max(msgReply, msgStarted) + standardLead + leadGen;
}

/** Traduz objetivos e define o rótulo de resultado principal fiel. */
const getLeadLabel = (m) => {
  if (m.conversas_leads > 0) return 'Leads';
  const obj = m.objetivo || '';
  if (obj.includes('TRAFFIC')) return 'Visitas';
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

    const cliente = await prisma.cliente.findFirst({ where: { nome: clienteNome } });
    if (!cliente) return NextResponse.json({ success: true, metrics: [], criativos: [] });

    // Normalização de datas para busca ignorando fusos horários conflitantes
    const dateUntil = until ? new Date(until + 'T23:59:59') : new Date();
    const dateSince = since ? new Date(since + 'T00:00:00') : new Date(new Date().setDate(dateUntil.getDate() - 30));

    const campanhas = await prisma.campanha.findMany({
      where: { cliente_id: cliente.id },
      include: { metricas: { where: { data: { gte: dateSince, lte: dateUntil } } } }
    });

    const metrics = campanhas.map(camp => {
      const total = camp.metricas.reduce((acc, m) => ({
        impressoes: acc.impressoes + m.impressoes,
        alcance: acc.alcance + m.alcance,
        cliques: acc.cliques + m.cliques,
        visitas_perfil: acc.visitas_perfil + m.visitas_perfil,
        seguidores: acc.seguidores + m.seguidores,
        conversas_leads: acc.conversas_leads + m.conversas_leads,
        valor_investido: acc.valor_investido + Number(m.valor_investido),
        compras: acc.compras + m.compras,
        valor_compras: acc.valor_compras + Number(m.valor_compras || 0),
        // Soma de engajamento total (cliques + salvamentos + reações + etc)
        engajamentoTotal: acc.engajamentoTotal + (m.cliques + m.visitas_perfil + m.seguidores) // Aproximação baseada nos campos disponíveis
      }), { impressoes: 0, alcance: 0, cliques: 0, visitas_perfil: 0, seguidores: 0, conversas_leads: 0, valor_investido: 0, compras: 0, valor_compras: 0, engajamentoTotal: 0 });

      const label = getLeadLabel({ ...total, objetivo: camp.objetivo });
      let finalVal = total.conversas_leads;
      let finalLabel = label;

      // Lógica de Resultado por Objetivo
      if (camp.nome_gerado.includes('[01]')) {
        finalVal = total.impressoes;
        finalLabel = 'Impressões';
        const cpm = total.impressoes > 0 ? (total.valor_investido / (total.impressoes / 1000)) : 0;
        return {
          ...total,
          objetivo: finalLabel,
          resultadoBruto: finalVal,
          roas: total.valor_investido > 0 ? total.valor_compras / total.valor_investido : 0,
          cpr: cpm,
          isCPM: true,
          campanha: { id: camp.id, nome_gerado: camp.nome_gerado, meta_id: camp.meta_id }
        };
      } else if (camp.nome_gerado.includes('[02]') || label === 'Engajamentos') {
        // Para engajamento, usamos a soma de interações
        finalVal = total.engajamentoTotal; 
        finalLabel = 'Engajamentos';
      } else if (camp.nome_gerado.includes('[05]')) {
        // Visitas puras vindas do link_click (312 reais)
        finalVal = total.visitas_perfil; 
        finalLabel = 'Visitas';
      } else if (label === 'Vendas') {
        finalVal = total.compras;
      }

      return {
        ...total,
        objetivo: finalLabel,
        resultadoBruto: finalVal,
        roas: total.valor_investido > 0 ? total.valor_compras / total.valor_investido : 0,
        cpr: finalVal > 0 ? (total.valor_investido / finalVal) : 0,
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
        alcance: acc.alcance + m.alcance,
        cliques: acc.cliques + m.cliques,
        valor_investido: acc.valor_investido + Number(m.valor_investido),
        leads: acc.leads + m.leads,
        compras: acc.compras + m.compras,
        totalCtr: acc.totalCtr + Number(m.ctr || 0),
        count: acc.count + 1
      }), { impressoes: 0, alcance: 0, cliques: 0, valor_investido: 0, leads: 0, compras: 0, totalCtr: 0, count: 0 });

      if (stats.impressoes === 0 && stats.valor_investido === 0) continue;

      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          id: c.id, nome_anuncio: key, url_midia: c.url_midia, texto_principal: c.texto_principal,
          ...stats
        });
      } else {
        const existing = groupedMap.get(key);
        existing.impressoes += stats.impressoes;
        existing.alcance += stats.alcance;
        existing.cliques += stats.cliques;
        existing.valor_investido += stats.valor_investido;
        existing.leads += stats.leads;
        existing.compras += stats.compras;
        existing.totalCtr += stats.totalCtr;
        existing.count += stats.count;
        if (!existing.url_midia) existing.url_midia = c.url_midia;
      }
    }

    const criativos = Array.from(groupedMap.values()).map(c => ({
      ...c, ctr: c.count > 0 ? c.totalCtr / c.count : 0
    }));

    // Agregação diária para gráfico de linha
    const dailyMap = new Map();
    for (const camp of campanhas) {
      const isConversionCamp = camp.objetivo.includes('MESSAGING') || camp.objetivo.includes('LEADS') || camp.objetivo.includes('CONVERSIONS') || camp.objetivo.includes('OUTCOME_LEADS');
      
      for (const m of camp.metricas) {
        const dateKey = m.data.toISOString().split('T')[0];
        if (!dailyMap.has(dateKey)) {
          dailyMap.set(dateKey, { data: dateKey, mensagens: 0, investimentoTotal: 0, investimentoConversao: 0 });
        }
        const day = dailyMap.get(dateKey);
        day.mensagens += m.conversas_leads;
        day.investimentoTotal += Number(m.valor_investido);
        if (isConversionCamp) {
          day.investimentoConversao += Number(m.valor_investido);
        }
      }
    }
    const dailyMetrics = Array.from(dailyMap.values())
      .sort((a, b) => a.data.localeCompare(b.data))
      .map(d => ({
        ...d,
        investimento: parseFloat(d.investimentoTotal.toFixed(2)),
        cpa: d.mensagens > 0 ? parseFloat((d.investimentoConversao / d.mensagens).toFixed(2)) : 0,
      }));

    return NextResponse.json({ success: true, metrics, criativos, dailyMetrics });
  } catch (error) {
    console.error("GET Metrics Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const syncStart = Date.now();
  console.time('Sync-Total');
  try {
    const reqBody = await request.json().catch(() => ({}));
    let { since, until, cliente } = reqBody;
    if (!cliente) return NextResponse.json({ success: false, error: "Cliente não fornecido" }, { status: 400 });

    const shortClientName = cliente.split(' ')[0];
    const rawAccountId = process.env[`META_AD_ACCOUNT_ID_${shortClientName}`];
    const ACCESS_TOKEN = process.env[`META_ACCESS_TOKEN_${shortClientName}`];
    if (!rawAccountId || !ACCESS_TOKEN) return NextResponse.json({ success: false, error: `Configuração ausente para ${cliente}` }, { status: 500 });

    const AD_ACCOUNT_ID = rawAccountId.startsWith('act_') ? rawAccountId : `act_${rawAccountId}`;
    const dbCliente = await prisma.cliente.findFirst({ where: { nome: cliente } });
    if (!dbCliente) throw new Error("Cliente não encontrado no banco de dados local.");

    // Bypass de Cache para HOJE
    const todayStr = new Date().toISOString().split('T')[0];
    const isToday = until === todayStr;

    console.time('Meta-API-Calls');
    const commonQuery = { access_token: ACCESS_TOKEN, limit: '1000' };
    
    // Se o pedido for "Hoje", usamos date_preset explicitamente para forçar dados novos da Meta
    if (isToday && since === todayStr) {
      commonQuery.date_preset = 'today';
    } else {
      commonQuery.time_range = JSON.stringify({ since, until });
    }

    const [metaCampsRes, campaignRes, adInsightRes, adsMetaRes] = await Promise.all([
      fetch(graphUrl(`${AD_ACCOUNT_ID}/campaigns`, { access_token: ACCESS_TOKEN, fields: 'id,name,objective', limit: '1000' })),
      fetch(graphUrl(`${AD_ACCOUNT_ID}/insights`, { ...commonQuery, fields: 'campaign_id,campaign_name,spend,impressions,reach,inline_link_click_ctr,clicks,actions,action_values', level: 'campaign', time_increment: '1' })),
      fetch(graphUrl(`${AD_ACCOUNT_ID}/insights`, { ...commonQuery, fields: 'ad_id,ad_name,campaign_id,spend,impressions,reach,inline_link_click_ctr,clicks,actions,action_values', level: 'ad', time_increment: '1' })),
      fetch(graphUrl(`${AD_ACCOUNT_ID}/adcreatives`, { access_token: ACCESS_TOKEN, fields: 'id,image_url,thumbnail_url,body,effective_object_story_id', limit: '1000' }))
    ]);

    const [metaCampsData, campaignData, adInsightData, adsMetaData] = await Promise.all([ 
      metaCampsRes.json(), campaignRes.json(), adInsightRes.json(), adsMetaRes.json() 
    ]);
    console.timeEnd('Meta-API-Calls');

    if (campaignData.error) throw new Error(`Meta API Error: ${campaignData.error.message}`);

    const objectiveMap = new Map(metaCampsData.data?.map(c => [c.id, c.objective]) || []);
    const creativeMetaMap = new Map(adsMetaData.data?.map(m => [String(m.id), m]) || []);
    
    // Busca HD Supremo (Posts) em lotes
    const storyIds = adsMetaData.data?.map(m => m.effective_object_story_id).filter(id => !!id) || [];
    const storyMetaMap = new Map();
    if (storyIds.length > 0) {
       console.time('Meta-HD-Images');
       const idChunks = [];
       for (let i = 0; i < storyIds.length; i += 50) idChunks.push(storyIds.slice(i, i + 50));
       await Promise.all(idChunks.map(async (chunk) => {
         const res = await fetch(graphUrl(``, { ids: chunk.join(','), fields: 'id,full_picture', access_token: ACCESS_TOKEN }));
         const data = await res.json();
         Object.values(data).forEach(post => storyMetaMap.set(post.id, post.full_picture));
       }));
       console.timeEnd('Meta-HD-Images');
    }

    const existingCamps = await prisma.campanha.findMany({ where: { cliente_id: dbCliente.id } });
    const localCampMap = new Map(existingCamps.map(c => [c.meta_id, c]));

    console.time('DB-Write-Campaigns');
    await batchProcess(campaignData.data || [], 5, async (item) => {
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
      
      // Log temporário para depuração de tipos de ações (ver no Vercel Logs)
      if (item.actions) {
        console.log(`Campanha ${item.campaign_name} Actions:`, JSON.stringify(item.actions));
      }

      return prisma.metricaCampanha.upsert({
        where: { campanha_id_data: { campanha_id: camp.id, data: dataInsight } },
        update: {
          impressoes: parseInt(item.impressions) || 0, alcance: parseInt(item.reach) || 0,
          cliques: parseInt(item.clicks) || 0, 
          visitas_perfil: getMetric(item.actions, 'link_click'), 
          seguidores: getMetric(item.actions, 'onsite_conversion.follow') + getMetric(item.actions, 'page_like') + getMetric(item.actions, 'onsite_conversion.instagram_smart_ad_follow') + getMetric(item.actions, 'instagram_smart_ad_follow'),
          valor_investido: parseFloat(item.spend) || 0, conversas_leads: getTrueLeads(item.actions),
          compras: getMetric(item.actions, 'purchase'), valor_compras: getMetric(item.action_values, 'purchase', true)
        },
        create: {
          campanha_id: camp.id, data: dataInsight,
          impressoes: parseInt(item.impressions) || 0, alcance: parseInt(item.reach) || 0,
          cliques: parseInt(item.clicks) || 0, 
          visitas_perfil: getMetric(item.actions, 'link_click'), 
          seguidores: getMetric(item.actions, 'onsite_conversion.follow') + getMetric(item.actions, 'page_like') + getMetric(item.actions, 'onsite_conversion.instagram_smart_ad_follow') + getMetric(item.actions, 'instagram_smart_ad_follow'),
          valor_investido: parseFloat(item.spend) || 0, conversas_leads: getTrueLeads(item.actions),
          compras: getMetric(item.actions, 'purchase'), valor_compras: getMetric(item.action_values, 'purchase', true)
        }
      });
    });
    console.timeEnd('DB-Write-Campaigns');

    if (adInsightData.data) {
      console.time('DB-Write-Creatives');
      const adsListRes = await fetch(graphUrl(`${AD_ACCOUNT_ID}/ads`, { access_token: ACCESS_TOKEN, fields: 'id,creative{id}', limit: '1000' }));
      const adsListData = await adsListRes.json();
      const adToCreativeMap = new Map(adsListData.data?.map(a => [a.id, a.creative.id]) || []);

      const existingCreatives = await prisma.criativo.findMany({ where: { campanha: { cliente_id: dbCliente.id } } });
      const localCreativeMap = new Map(existingCreatives.map(c => [c.meta_ad_id, c]));

      await batchProcess(adInsightData.data, 5, async (row) => {
        const camp = localCampMap.get(String(row.campaign_id));
        if (!camp) return;

        const creativeId = adToCreativeMap.get(String(row.ad_id));
        const adMeta = creativeMetaMap.get(String(creativeId)) || {};
        const highResImage = storyMetaMap.get(adMeta.effective_object_story_id) || adMeta.image_url || adMeta.thumbnail_url;

        let criativo = localCreativeMap.get(String(row.ad_id));
        if (!criativo) {
          criativo = await prisma.criativo.upsert({
            where: { meta_ad_id: String(row.ad_id) },
            update: { nome_anuncio: row.ad_name, url_midia: highResImage, texto_principal: adMeta.body },
            create: { meta_ad_id: String(row.ad_id), campanha_id: camp.id, nome_anuncio: row.ad_name, url_midia: highResImage, texto_principal: adMeta.body }
          });
          localCreativeMap.set(criativo.meta_ad_id, criativo);
        }

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
      console.timeEnd('DB-Write-Creatives');
    }

    console.timeEnd('Sync-Total');
    return NextResponse.json({ success: true, duration: `${(Date.now() - syncStart) / 1000}s` });
  } catch (error) {
    console.error("POST Sync Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
