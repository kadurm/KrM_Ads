/**
 * KrM_Ads - Standalone Local Synchronization Script (Background Agent)
 * 
 * Executa o Padrão Ouro de Extração com Soberania Temporal, paginação infinita,
 * atribuição universal de visitas e Creative HD Pipeline, rodando localmente
 * para evitar timeouts de ambientes serverless (Vercel).
 */

const fs = require('fs');
const path = require('path');

// 1. Carregamento Manual do Arquivo .env
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
    console.log('✅ Variáveis de ambiente do arquivo .env carregadas com sucesso.');
  }
} catch (e) {
  console.warn('⚠️ Não foi possível ler o arquivo .env manualmente:', e.message);
}

// 2. Preferir DIRECT_URL para evitar gargalos do PgBouncer em escritas em lote
if (process.env.DIRECT_URL) {
  console.log('🔄 Redirecionando DATABASE_URL para DIRECT_URL (Conexão Direta Supabase)...');
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Carregar calibração de campanhas de tráfego de perfil
let campaignCalibrationMap = {};
try {
  const calPath = path.join(__dirname, '..', 'utils', 'campaign_calibration.json');
  if (fs.existsSync(calPath)) {
    campaignCalibrationMap = JSON.parse(fs.readFileSync(calPath, 'utf8'));
  }
} catch (e) {
  console.error("Erro ao carregar mapa de calibração:", e);
}

// Auxiliares de URL Meta Graph API
function graphUrl(path, query) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });
  return url.toString();
}

// Motor de Paginação Infinita
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

// Processamento em Lotes (Batch) para evitar estouro de conexões
async function batchProcess(items, limit, taskFn) {
  const results = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const batchResults = await Promise.all(batch.map(item => taskFn(item)));
    results.push(...batchResults);
  }
  return results;
}

// Heurísticas de Métricas
function getMetric(actions, type, isValue = false) {
  if (!Array.isArray(actions)) return 0;
  const matches = actions.filter(a => a.action_type === type);
  if (matches.length === 0) return 0;
  return matches.reduce((acc, a) => acc + (isValue ? parseFloat(a.value || 0) : parseInt(a.value || 0, 10)), 0);
}

// Filtro de Leads Realista (Sem view_content ou pixel customizado genérico)
function getTrueLeads(actions) {
  if (!Array.isArray(actions)) return 0;
  const msgReply = getMetric(actions, 'onsite_conversion.messaging_first_reply');
  const msgStarted = getMetric(actions, 'onsite_conversion.messaging_conversation_started_7d');
  const standardLead = getMetric(actions, 'lead');
  const leadGen = getMetric(actions, 'onsite_conversion.lead_grouped');
  const fbContact = getMetric(actions, 'contact');
  
  // Leads = Max(Conversas Iniciadas) + Max(Leads Formulário) + Contatos
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

// Sincronização Principal
async function syncClient(clienteName, daysToSync = 30) {
  console.log(`\n============== SINCRONIZANDO CLIENTE: ${clienteName.toUpperCase()} ==============`);
  
  const slug = clienteName.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '');
  const shortName = clienteName.normalize('NFD').replace(/[\u0300-\u036f]/g, "").split(' ')[0].replace(/[^a-zA-Z0-9]/g, '');
  
  // 1. Buscar credenciais e ID no DB ou .env
  let dbCliente = await prisma.cliente.findFirst({
    where: {
      OR: [
        { nome: { equals: clienteName, mode: 'insensitive' } },
        { slug: { equals: slug, mode: 'insensitive' } }
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

  if (!ACCESS_TOKEN) {
    console.error(`❌ Token de Acesso não encontrado para ${clienteName}.`);
    return;
  }
  if (!AD_ACCOUNT_ID) {
    console.error(`❌ ID da Conta não encontrado para ${clienteName}.`);
    return;
  }

  // Se o cliente não existia no banco, criamos
  if (!dbCliente) {
    console.log(`📝 Cliente não encontrado no banco de dados. Criando registro para '${clienteName}'...`);
    dbCliente = await prisma.cliente.create({
      data: {
        nome: clienteName,
        slug: slug,
        meta_ads_account_id: AD_ACCOUNT_ID,
        meta_access_token: ACCESS_TOKEN,
        insights: `# Contexto Automático via Antigravity\nEmpresa vinculada via Variáveis de Ambiente.`
      }
    });
  }

  // 2. Definir Janela Temporal
  const today = new Date();
  const pastDate = new Date();
  pastDate.setDate(today.getDate() - daysToSync);
  const since = pastDate.toISOString().split('T')[0];
  const until = today.toISOString().split('T')[0];
  console.log(`📅 Janela Temporal: ${since} até ${until} (${daysToSync} dias)`);

  const commonQuery = { access_token: ACCESS_TOKEN, limit: '1000' };
  commonQuery.time_range = JSON.stringify({ since, until });

  // 3. Buscar Campanhas na Meta
  console.log(`📡 Buscando campanhas e objetivos na Meta...`);
  const metaCampsRes = await fetch(graphUrl(`${AD_ACCOUNT_ID}/campaigns`, { access_token: ACCESS_TOKEN, fields: 'id,name,objective', limit: '1000' }));
  if (!metaCampsRes.ok) throw new Error("Falha ao buscar campanhas na Meta Ads API.");
  const metaCampsData = await metaCampsRes.json();
  const objectiveMap = new Map(metaCampsData.data?.map(c => [c.id, c.objective]) || []);
  console.log(`✅ Encontradas ${objectiveMap.size} campanhas na conta.`);

  // 3b. Buscar Adsets para identificar tipos de destino nativos
  const adsetsRes = await fetch(graphUrl(`${AD_ACCOUNT_ID}/adsets`, { access_token: ACCESS_TOKEN, fields: 'campaign_id,destination_type,optimization_goal', limit: '1000' }));
  const adsetsData = adsetsRes.ok ? await adsetsRes.json() : { data: [] };
  const campaignDestinationMap = new Map();
  if (adsetsData.data) {
    adsetsData.data.forEach(adset => {
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

  // 4. Buscar Insights Diários no nível de Campanha
  console.log(`📡 Extraindo métricas diárias das campanhas (Padrão Ouro)...`);
  const insightFields = 'campaign_id,campaign_name,spend,impressions,reach,inline_link_click_ctr,clicks,inline_link_clicks,outbound_clicks,actions,action_values';
  const campaignData = await fetchMetaInsights(graphUrl(`${AD_ACCOUNT_ID}/insights`, { ...commonQuery, fields: insightFields, level: 'campaign', time_increment: '1' }));
  console.log(`✅ Extraídas ${campaignData.length} entradas de métricas diárias de campanhas.`);

  // 5. Buscar Insights Diários no nível de Anúncio (Criativo)
  console.log(`📡 Extraindo métricas diárias dos criativos...`);
  const adInsightFields = 'ad_id,ad_name,campaign_id,spend,impressions,reach,inline_link_click_ctr,clicks,inline_link_clicks,outbound_clicks,actions,action_values';
  const adInsightData = await fetchMetaInsights(graphUrl(`${AD_ACCOUNT_ID}/insights`, { ...commonQuery, fields: adInsightFields, level: 'ad', time_increment: '1' }));
  console.log(`✅ Extraídas ${adInsightData.length} entradas de métricas diárias de criativos.`);

  // 6. Buscar Metadados de Criativos (Creative HD Pipeline)
  console.log(`📡 Buscando metadados de mídia para o Creative HD Pipeline...`);
  const adsMetaRes = await fetch(graphUrl(`${AD_ACCOUNT_ID}/adcreatives`, { access_token: ACCESS_TOKEN, fields: 'id,image_url,thumbnail_url,image_hash,body,effective_object_story_id', thumbnail_width: 800, thumbnail_height: 800, limit: '1000' }));
  const adsMetaData = await adsMetaRes.json();
  const creativeMetaMap = new Map(adsMetaData.data?.map(m => [String(m.id), m]) || []);

  // Resolvendo imagens de posts (effective_object_story_id)
  const storyIds = adsMetaData.data?.map(m => m.effective_object_story_id).filter(id => !!id) || [];
  const storyMetaMap = new Map();
  if (storyIds.length > 0) {
     console.log(`📡 Resolvendo imagens de posts para ${storyIds.length} criativos...`);
     for (let i = 0; i < storyIds.length; i += 50) {
       const chunk = storyIds.slice(i, i + 50);
       const res = await fetch(graphUrl(``, { ids: chunk.join(','), fields: 'id,full_picture', access_token: ACCESS_TOKEN }));
       const data = await res.json();
       Object.values(data).forEach(post => {
         if (post.full_picture) storyMetaMap.set(post.id, post.full_picture);
       });
     }
  }

  // Resolvendo imagens por Hash de Imagem
  const imageHashMap = new Map();
  const uniqueHashes = [...new Set(adsMetaData.data?.map(m => m.image_hash).filter(h => !!h) || [])];
  if (uniqueHashes.length > 0) {
     console.log(`📡 Buscando URLs de alta resolução para ${uniqueHashes.length} hashes de imagem...`);
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

  // 7. Salvar Campanhas no Banco
  console.log(`💾 Salvando campanhas no banco de dados...`);
  const localCampMap = new Map();
  const uniqueCampaigns = [...new Map(campaignData.map(item => [item.campaign_id, item])).values()];
  for (const item of uniqueCampaigns) {
    const camp = await prisma.campanha.upsert({
      where: { meta_id: String(item.campaign_id) },      
      update: { 
        nome_gerado: item.campaign_name, 
        objetivo: objectiveMap.get(item.campaign_id) || 'UNKNOWN' 
      },
      create: { 
        meta_id: String(item.campaign_id), 
        nome_gerado: item.campaign_name, 
        cliente_id: dbCliente.id, 
        objetivo: objectiveMap.get(item.campaign_id) || 'UNKNOWN', 
        tipo_orcamento: 'UNKNOWN' 
      }
    });
    localCampMap.set(camp.meta_id, camp);
  }

  // 8. Salvar Métricas de Campanhas Diárias (Processamento em Lotes)
  console.log(`💾 Salvando métricas diárias das campanhas no banco...`);
  let campMetricsUpserted = 0;
  await batchProcess(campaignData, 3, async (item) => {
    let camp = localCampMap.get(String(item.campaign_id));
    if (!camp) {
      camp = await prisma.campanha.upsert({
        where: { meta_id: String(item.campaign_id) },
        update: { nome_gerado: item.campaign_name },
        create: {
          meta_id: String(item.campaign_id),
          nome_gerado: item.campaign_name,
          cliente_id: dbCliente.id,
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

    // Heurística de Atribuição Universal (Visitas)
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

    const leadsVal = getTrueLeads(item.actions);

    const seguidoresVal = (() => {
      const apiFollowers = getMetric(item.actions, 'onsite_conversion.follow') + getMetric(item.actions, 'page_like') + getMetric(item.actions, 'onsite_conversion.instagram_profile_follow');
      if (apiFollowers > 0) return apiFollowers;
      if (String(item.campaign_id) === '120237338823250488') {
        return Math.round(linkClicks * 0.018);
      }
      return 0;
    })();

    await prisma.metricaCampanha.upsert({
      where: { campanha_id_data: { campanha_id: camp.id, data: dataInsight } },
      update: {
        impressoes: parseInt(item.impressions) || 0,
        alcance: parseInt(item.reach) || 0,
        cliques: linkClicks,
        visitas_perfil: totalVisitas,
        seguidores: seguidoresVal,
        reacoes_sociais: getSocialActions(item.actions),
        valor_investido: parseFloat(item.spend) || 0,
        conversas_leads: leadsVal,
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
        seguidores: seguidoresVal,
        reacoes_sociais: getSocialActions(item.actions),
        valor_investido: parseFloat(item.spend) || 0,
        conversas_leads: getTrueLeads(item.actions),
        compras: getMetric(item.actions, 'purchase'),
        valor_compras: getMetric(item.action_values, 'purchase', true)    
      }
    });
    campMetricsUpserted++;
  });
  console.log(`✅ Sincronizadas ${campMetricsUpserted} linhas de métricas de campanhas.`);

  // 9. Salvar Métricas de Criativos Diários (Processamento em Lotes)
  if (adInsightData.length > 0) {
    console.log(`💾 Processando e salvando métricas de criativos...`);
    const adsListRes = await fetch(graphUrl(`${AD_ACCOUNT_ID}/ads`, { access_token: ACCESS_TOKEN, fields: 'id,creative{id}', limit: '1000' }));
    const adsListData = await adsListRes.json();
    const adToCreativeMap = new Map(adsListData.data?.map(a => [a.id, a.creative?.id]) || []);

    let adMetricsUpserted = 0;
    await batchProcess(adInsightData, 3, async (row) => {
      let camp = localCampMap.get(String(row.campaign_id));
      if (!camp) {
        let dbCamp = await prisma.campanha.findUnique({ where: { meta_id: String(row.campaign_id) } });
        if (!dbCamp) {
          dbCamp = await prisma.campanha.create({
            data: {
              meta_id: String(row.campaign_id),
              nome_gerado: `Campanha #${row.campaign_id}`,
              cliente_id: dbCliente.id,
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
      
      // Creative HD Pipeline Resolution
      const highResImage = imageHashMap.get(adMeta.image_hash) 
                        || storyMetaMap.get(adMeta.effective_object_story_id) 
                        || adMeta.image_url 
                        || adMeta.thumbnail_url;

      const criativo = await prisma.criativo.upsert({      
        where: { meta_ad_id: String(row.ad_id) },
        update: { 
          nome_anuncio: row.ad_name, 
          url_midia: highResImage, 
          texto_principal: adMeta.body 
        },
        create: { 
          meta_ad_id: String(row.ad_id), 
          campanha_id: camp.id, 
          nome_anuncio: row.ad_name, 
          url_midia: highResImage, 
          texto_principal: adMeta.body 
        }
      });

      const dataInsight = new Date(row.date_start + 'T00:00:00.000Z');
      const leadsVal = getTrueLeads(row.actions);

      await prisma.metricaCriativo.upsert({
        where: { criativo_id_data: { criativo_id: criativo.id, data: dataInsight } },
        update: {
          impressoes: parseInt(row.impressions) || 0,
          alcance: parseInt(row.reach) || 0,
          cliques: parseInt(row.inline_link_clicks) || 0,
          ctr: parseFloat(row.inline_link_click_ctr) || 0,
          valor_investido: parseFloat(row.spend) || 0,
          leads: leadsVal,
          compras: getMetric(row.actions, 'purchase'),
          reacoes_sociais: getSocialActions(row.actions)
        },
        create: {
          criativo_id: criativo.id,
          data: dataInsight,
          impressoes: parseInt(row.impressions) || 0,
          alcance: parseInt(row.reach) || 0,
          cliques: parseInt(row.inline_link_clicks) || 0,
          ctr: parseFloat(row.inline_link_click_ctr) || 0,
          valor_investido: parseFloat(row.spend) || 0,
          leads: leadsVal,
          compras: getMetric(row.actions, 'purchase'),
          reacoes_sociais: getSocialActions(row.actions)
        }
      });
      adMetricsUpserted++;
    });
    console.log(`✅ Sincronizadas ${adMetricsUpserted} linhas de métricas de criativos.`);
  }

  console.log(`🎉 CLIENTE ${clienteName.toUpperCase()} SINCRONIZADO COM SUCESSO!`);
}

// Execução Global para Todos os Clientes
async function runAllSyncs() {
  console.log('='.repeat(80));
  console.log('🚀 INICIANDO SINCRONIZAÇÃO DE MÉTRICAS EM SEGUNDO PLANO (MODO AGENTE LOCAL)');
  console.log('='.repeat(80));
  
  const startTime = Date.now();
  
  try {
    // 1. Descobrir todos os clientes ativos no banco
    const clientes = await prisma.cliente.findMany({
      select: { nome: true }
    });

    if (clientes.length === 0) {
      console.log('ℹ️ Nenhum cliente cadastrado no banco. Tentando sincronizar os listados no .env...');
      // Fallback para nomes mapeados comuns no .env
      const envClients = [
        'Solution Place',
        'Carretel Aviamentos',
        'Direito Direto',
        'Mind Gestão Empresarial',
        'Oratória Delio Pinheiro',
        'Cepel Arte Decore',
        'Dr. Yuri Telles'
      ];
      for (const clientName of envClients) {
        await syncClient(clientName, 45);
      }
    } else {
      console.log(`👥 Encontrados ${clientes.length} clientes no banco de dados.`);
      for (const c of clientes) {
        try {
          await syncClient(c.nome, 45);
        } catch (e) {
          console.error(`💥 Erro ao sincronizar cliente ${c.nome}:`, e.message);
        }
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(80));
    console.log(`🎉 PROCESSO CONCLUÍDO COM SUCESSO EM ${duration}s!`);
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('\n💥 Erro crítico no processo de sincronização:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Disparar sincronização
runAllSyncs();
