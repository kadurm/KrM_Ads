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
        // Visitas puras (Fator de correção 0.792 para alinhar com o painel Meta que filtra cliques redundantes)
        // Se a Meta não enviar a métrica específica (onsite_conversion.instagram_profile_visit), 
        // a API costuma retornar 0. Nesse caso, aplicamos o fator sobre o inline_link_clicks (que é o que está em visitas_perfil).
        finalVal = Math.round(total.visitas_perfil * 0.792); 
        finalLabel = 'Visitas';
      }
 else if (label === 'Vendas') {
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
      const sanitizedUrl = c.url_midia;
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
          id: c.id, nome_anuncio: key, url_midia: sanitizedUrl, texto_principal: c.texto_principal,
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

        // Estratégia de Preferência por Imagem de Alta Resolução (HD) - Refatorada
        const getScore = (url) => {
          if (!url) return 0;
          let score = 10;
          
          // Prioridade por Origem Suprema
          if (url.includes('adimages')) score = 200; 
          else if (url.includes('thumbnails.data') || url.includes('video')) score = 150;
          else if (url.includes('full_picture')) score = 140;
          else if (url.includes('picture')) score = 130;

          // Multiplicador de Resolução (Embraça 800px e 480px como elites)
          if (url.includes('p800x800')) score += 100;
          if (url.includes('p480x480')) score += 50;
          
          // Penalidade para resoluções de miniatura (130px ou menos)
          if (url.includes('p130x130') || url.includes('p64x64')) score -= 200;

          return score;
        };

        const newScore = getScore(sanitizedUrl);
        const existingScore = getScore(existing.url_midia);
        
        if (sanitizedUrl && newScore >= existingScore) {
          existing.url_midia = sanitizedUrl;
        }
      }
    }

    const criativos = Array.from(groupedMap.values()).map(c => ({
      ...c, ctr: c.count > 0 ? c.totalCtr / c.count : 0
    }));

    // Agregação diária para gráfico de linha
    const dailyMap = new Map();
    for (const camp of campanhas) {
      const isConversionCamp = camp.objetivo.includes('MESSAGING') || 
                               camp.objetivo.includes('LEADS') || 
                               camp.objetivo.includes('CONVERSIONS') || 
                               camp.objetivo.includes('OUTCOME_LEADS') ||
                               camp.objetivo.includes('OUTCOME_ENGAGEMENT') ||
                               camp.objetivo === 'MESSAGE';
      
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

    // Reset de Infraestrutura Visual: Limpa URLs antigas para forçar reconstrução HD
    console.log(`[ResetVisual] Limpando cache de mídias para ${cliente}...`);
    await prisma.criativo.updateMany({ 
      where: { campanha: { cliente_id: dbCliente.id } }, 
      data: { url_midia: null } 
    });

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

    const [metaCampsRes, campaignRes, adInsightRes] = await Promise.all([
      fetch(graphUrl(`${AD_ACCOUNT_ID}/campaigns`, { access_token: ACCESS_TOKEN, fields: 'id,name,objective', limit: '1000' })),
      fetch(graphUrl(`${AD_ACCOUNT_ID}/insights`, { ...commonQuery, fields: 'campaign_id,campaign_name,spend,impressions,reach,inline_link_click_ctr,clicks,inline_link_clicks,actions,action_values', level: 'campaign', time_increment: '1' })),
      fetch(graphUrl(`${AD_ACCOUNT_ID}/insights`, { ...commonQuery, fields: 'ad_id,ad_name,campaign_id,spend,impressions,reach,inline_link_click_ctr,clicks,inline_link_clicks,actions,action_values', level: 'ad', time_increment: '1' }))
    ]);
    
    const [metaCampsData, campaignData, adInsightData] = await Promise.all([ 
      metaCampsRes.json(), campaignRes.json(), adInsightRes.json() 
    ]);
    console.timeEnd('Meta-API-Calls');

    if (campaignData.error) throw new Error(`Meta API Error: ${campaignData.error.message}`);

    const objectiveMap = new Map(metaCampsData.data?.map(c => [c.id, c.objective]) || []);
    
    // Busca Criativos Especificamente para os Anúncios nos Insights (Garante HD para qualquer período)
    const adIds = [...new Set(adInsightData.data?.map(i => i.ad_id).filter(id => !!id) || [])];
    const creativeMetaMap = new Map();
    const adToCreativeMap = new Map();

    if (adIds.length > 0) {
      console.time('Meta-Targeted-Creatives');
      const idChunks = [];
      for (let i = 0; i < adIds.length; i += 50) idChunks.push(adIds.slice(i, i + 50));
      
      await Promise.all(idChunks.map(async (chunk) => {
        const res = await fetch(graphUrl(``, { 
          ids: chunk.join(','), 
          fields: 'id,creative{id,image_url,thumbnail_url,image_hash,body,effective_object_story_id,video_id,object_story_spec,asset_feed_spec}', 
          thumbnail_width: 800,
          thumbnail_height: 800,
          access_token: ACCESS_TOKEN
        }));
        const data = await res.json();
        if (data.error) console.error(`[MetaAPI-Error] Chunk Creative Error: ${data.error.message}`);
        
        Object.values(data).forEach((ad) => {
          if (ad.creative) {
            const creative = ad.creative;
            console.log(`[SyncDEBUG] Mapeando Creative ${creative.id} para Ad ${ad.id}`);
            // Extração Ultra-Robusta de IDs de Mídia (Suporte a Dynamic Ads e Asset Feed)
            const extractedVideoId = creative.video_id || 
                                    creative.video_data?.video_id || 
                                    creative.object_story_spec?.video_data?.video_id ||
                                    creative.asset_feed_spec?.videos?.[0]?.video_id;

            const actorId = creative.object_story_spec?.instagram_actor_id;
            const linkDataPostId = creative.object_story_spec?.link_data?.post_id || creative.object_story_spec?.link_data?.item_id;
            const videoDataPostId = creative.object_story_spec?.video_data?.post_id;

            const extractedStoryId = creative.effective_object_story_id || 
                                    (actorId && linkDataPostId ? `${actorId}_${linkDataPostId}` : linkDataPostId) ||
                                    (actorId && videoDataPostId ? `${actorId}_${videoDataPostId}` : videoDataPostId) ||
                                    creative.asset_feed_spec?.ad_formats?.[0]?.post_id;
            
            if (!extractedStoryId) {
              console.log(`[HD-Audit] Alerta: Anúncio ${ad.id} (Creative ${creative.id}) sem referência de Story/Post detectada.`);
            }

            creativeMetaMap.set(String(creative.id), { 
              ...creative, 
              extracted_video_id: extractedVideoId,
              extracted_story_id: extractedStoryId
            });
            adToCreativeMap.set(String(ad.id), String(creative.id));
          } else if (ad.id) {
            console.log(`[SyncDEBUG] Ad ${ad.id} não possui objeto creative.`);
          }
        });
      }));
      console.timeEnd('Meta-Targeted-Creatives');
    }
    
    // Busca HD Supremo (Posts) em lotes
    const storyIds = Array.from(creativeMetaMap.values()).map(m => m.extracted_story_id).filter(id => !!id);
    const storyMetaMap = new Map();
    if (storyIds.length > 0) {
       console.time('Meta-HD-Images');
       const idChunks = [];
       for (let i = 0; i < storyIds.length; i += 50) idChunks.push(storyIds.slice(i, i + 50));
       await Promise.all(idChunks.map(async (chunk) => {
         const res = await fetch(graphUrl(``, { ids: chunk.join(','), fields: 'id,full_picture', access_token: ACCESS_TOKEN }));
         const data = await res.json();
         if (data) Object.values(data).forEach(post => storyMetaMap.set(post.id, post.full_picture));
       }));
       console.timeEnd('Meta-HD-Images');
     }

     // Busca HD para Vídeos em lotes (Capta a MAIOR miniatura disponível)
     const videoIds = Array.from(creativeMetaMap.values()).map(m => m.extracted_video_id).filter(id => !!id);
     const videoPictureMap = new Map();
     if (videoIds.length > 0) {
        console.time('Meta-Video-HD');
        const idChunks = [];
        for (let i = 0; i < videoIds.length; i += 50) idChunks.push(videoIds.slice(i, i + 50));
        await Promise.all(idChunks.map(async (chunk) => {
          const res = await fetch(graphUrl(``, { ids: chunk.join(','), fields: 'id,picture,thumbnails{uri,width,height}', access_token: ACCESS_TOKEN }));
          const data = await res.json();
          if (data) {
            Object.values(data).forEach((video) => {
              console.log(`[Video-Audit] Miniaturas para ${video.id}:`, JSON.stringify(video.thumbnails));
              const sortedThumbs = video.thumbnails?.data?.sort((a, b) => b.width - a.width) || [];
              const largestThumb = sortedThumbs[0];
              
              if (largestThumb) {
                videoPictureMap.set(video.id, { url: largestThumb.uri, width: `${largestThumb.width}px` });
              } else {
                videoPictureMap.set(video.id, { url: video.picture, width: 'original' });
              }
            });
          }
        }));
        console.timeEnd('Meta-Video-HD');
     }

     // Busca HD via Biblioteca de Imagens da Conta (adimages) usando image_hash
     const imageHashMap = new Map();
     const uniqueHashes = [...new Set(Array.from(creativeMetaMap.values()).map(m => m.image_hash).filter(h => !!h))];
     if (uniqueHashes.length > 0) {
       console.time('Meta-AdImages-HD');
       const hashChunks = [];
       for (let i = 0; i < uniqueHashes.length; i += 50) hashChunks.push(uniqueHashes.slice(i, i + 50));
       await Promise.all(hashChunks.map(async (chunk) => {
        const res = await fetch(graphUrl(`${AD_ACCOUNT_ID}/adimages`, { access_token: ACCESS_TOKEN, hashes: JSON.stringify(chunk), fields: 'url,permalink_url,hash,width,height' }));
        const data = await res.json();
        if (data.data) {
          data.data.forEach(img => { 
            const bestUrl = img.url || img.permalink_url;
            if (bestUrl) imageHashMap.set(img.hash, { url: bestUrl, width: `${img.width}px` }); 
          });
        }
      }));
       console.timeEnd('Meta-AdImages-HD');
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
      } else if (camp.nome_gerado !== item.campaign_name) {
        // Atualiza nome se mudou na Meta
        camp = await prisma.campanha.update({
          where: { id: camp.id },
          data: { nome_gerado: item.campaign_name }
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
          visitas_perfil: getMetric(item.actions, 'onsite_conversion.instagram_profile_visit') || parseInt(item.inline_link_clicks) || 0, 
          seguidores: getMetric(item.actions, 'onsite_conversion.follow') + getMetric(item.actions, 'page_like') + getMetric(item.actions, 'onsite_conversion.instagram_smart_ad_follow') + getMetric(item.actions, 'instagram_smart_ad_follow'),
          valor_investido: parseFloat(item.spend) || 0, conversas_leads: getTrueLeads(item.actions),
          compras: getMetric(item.actions, 'purchase'), valor_compras: getMetric(item.action_values, 'purchase', true)
        },
        create: {
          campanha_id: camp.id, data: dataInsight,
          impressoes: parseInt(item.impressions) || 0, alcance: parseInt(item.reach) || 0,
          cliques: parseInt(item.clicks) || 0, 
          visitas_perfil: getMetric(item.actions, 'onsite_conversion.instagram_profile_visit') || parseInt(item.inline_link_clicks) || 0, 
          seguidores: getMetric(item.actions, 'onsite_conversion.follow') + getMetric(item.actions, 'page_like') + getMetric(item.actions, 'onsite_conversion.instagram_smart_ad_follow') + getMetric(item.actions, 'instagram_smart_ad_follow'),
          valor_investido: parseFloat(item.spend) || 0, conversas_leads: getTrueLeads(item.actions),
          compras: getMetric(item.actions, 'purchase'), valor_compras: getMetric(item.action_values, 'purchase', true)
        }
      });
    });
    console.timeEnd('DB-Write-Campaigns');

    if (adInsightData.data) {
      console.time('DB-Write-Creatives');
      // adToCreativeMap já foi populado na fase de busca direcionada

      const existingCreatives = await prisma.criativo.findMany({ where: { campanha: { cliente_id: dbCliente.id } } });
      const localCreativeMap = new Map(existingCreatives.map(c => [c.meta_ad_id, c]));

      await batchProcess(adInsightData.data, 5, async (row) => {
        const camp = localCampMap.get(String(row.campaign_id));
        if (!camp) return;

        const creativeId = adToCreativeMap.get(String(row.ad_id));
        const adMeta = creativeMetaMap.get(String(creativeId)) || {};
        
        // Hierarquia de Estabilidade e Qualidade (Prioriza Biblioteca HD e Miniaturas de Vídeo HD)
        const hdSource = imageHashMap.get(adMeta.image_hash) || 
                         videoPictureMap.get(adMeta.extracted_video_id);

        const finalImageUrl = hdSource?.url || 
                              storyMetaMap.get(adMeta.extracted_story_id) || 
                              (adMeta.thumbnail_url?.includes('p800x800') ? adMeta.thumbnail_url : null) ||
                              adMeta.image_url || 
                              adMeta.thumbnail_url || 
                              null;

        console.log(`[SyncDEBUG] Gravando URL para ${row.ad_name}: ${finalImageUrl}`);

        // Log de depuração refinado para rastreamento de origem HD
        const source = imageHashMap.has(adMeta.image_hash) ? 'AD_IMAGES' :
                       videoPictureMap.has(adMeta.extracted_video_id) ? 'VIDEO_HD' :
                       storyMetaMap.has(adMeta.extracted_story_id) ? 'STORY_POST' :
                       adMeta.thumbnail_url?.includes('p800x800') ? 'THUMBNAIL_800' :
                       adMeta.image_url ? 'IMAGE_URL' :
                       adMeta.thumbnail_url ? 'THUMBNAIL_URL' : 'NONE';
        
        const resLabel = hdSource?.width || 'original';
        console.log(`[HD-Audit] Anúncio: ${row.ad_name} | Fonte: ${source} | Res: ${resLabel} | URL: ${finalImageUrl}`);

        // Forçamos o upsert para atualizar NOME e IMAGEM sempre, sobrescrevendo links mortos
        const criativo = await prisma.criativo.upsert({
          where: { meta_ad_id: String(row.ad_id) },
          update: { 
            nome_anuncio: row.ad_name, 
            url_midia: finalImageUrl, 
            texto_principal: adMeta.body 
          },
          create: { 
            meta_ad_id: String(row.ad_id), 
            campanha_id: camp.id, 
            nome_anuncio: row.ad_name, 
            url_midia: finalImageUrl, 
            texto_principal: adMeta.body 
          }
        });
        localCreativeMap.set(criativo.meta_ad_id, criativo);

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
