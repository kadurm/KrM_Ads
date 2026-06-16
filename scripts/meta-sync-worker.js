/**
 * KrM_Ads - Standalone Meta Ads ETL Worker
 * 
 * Executa o Padrão Ouro de Extração com fuso horário correto,
 * rolling window de 7 dias, paginação infinita rígida, idempotência absoluta
 * e resiliência via Exponential Backoff no GitHub Actions.
 */

const fs = require('fs');
const path = require('path');

// --- 1. CARREGAMENTO DE VARIÁVEIS DE AMBIENTE ---
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
    console.log('✅ Arquivo .env carregado localmente.');
  }
} catch (e) {
  console.warn('⚠️ Não foi possível ler .env local:', e.message);
}

// Conexão direta Supabase para processos em lote CLI
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Carregar configurações de calibração manual
let campaignCalibrationMap = {};
try {
  const calPath = path.join(__dirname, '..', 'utils', 'campaign_calibration.json');
  if (fs.existsSync(calPath)) {
    campaignCalibrationMap = JSON.parse(fs.readFileSync(calPath, 'utf8'));
  }
} catch (e) {
  console.error("Erro ao carregar mapa de calibração:", e.message);
}

// --- 2. AUXILIARES E RESILIÊNCIA DA META GRAPH API ---
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

// Wrapper com Exponential Backoff para Rate Limit (Erro 17/4) e instabilidade
async function fetchMetaWithRetry(url, options = {}) {
  let attempts = 0;
  const maxAttempts = 5;
  let delayTime = 1000;

  while (attempts < maxAttempts) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const err = await res.json();
        const errCode = err.error?.code;
        
        // Códigos de Rate limit Meta Ads: 4, 17, 32, 80000, 80007, ou HTTP 429
        const isRateLimit = errCode === 4 || errCode === 17 || errCode === 32 || errCode === 80000 || errCode === 80007 || res.status === 429;
        
        if (isRateLimit && attempts < maxAttempts - 1) {
          attempts++;
          const jitter = Math.random() * 500;
          console.warn(`⚠️ [Rate Limit] Código ${errCode}. Retentativa ${attempts}/${maxAttempts} em ${delayTime + jitter}ms...`);
          await delay(delayTime + jitter);
          delayTime *= 2;
          continue;
        }
        throw new Error(`Meta API Error: ${err.error?.message || res.statusText}`);
      }
      return await res.json();
    } catch (error) {
      if (attempts < maxAttempts - 1) {
        attempts++;
        console.warn(`⚠️ [Falha de Rede] ${error.message}. Retentativa ${attempts}/${maxAttempts} em ${delayTime}ms...`);
        await delay(delayTime);
        delayTime *= 2;
        continue;
      }
      throw error;
    }
  }
}

// Paginação Rígida completa seguindo os cursores
async function fetchMetaPaginated(url) {
  let allData = [];
  let currentUrl = url;

  while (currentUrl) {
    const json = await fetchMetaWithRetry(currentUrl);
    if (json.data) {
      allData = [...allData, ...json.data];
    }
    currentUrl = json.paging?.next || null;
  }
  return allData;
}

// --- 3. CONVERSORES DE TIMEZONE ---
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
    const json = await fetchMetaWithRetry(graphUrl(accountId, {
      access_token: accessToken,
      fields: 'timezone_name'
    }));
    return json.timezone_name || 'America/Sao_Paulo';
  } catch (error) {
    console.error(`⚠️ Não foi possível obter fuso horário da conta ${accountId}:`, error.message);
    return 'America/Sao_Paulo';
  }
}

// Heurísticas de Atribuição e Métricas
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

async function batchProcess(items, limit, taskFn) {
  const results = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const batchResults = await Promise.all(batch.map(item => taskFn(item)));
    results.push(...batchResults);
  }
  return results;
}

// --- 4. FLUXO DE SINCRONIZAÇÃO POR CLIENTE ---
async function syncClient(dbCliente, daysToSync = 7) {
  console.log(`\n======================================================`);
  console.log(`📡 INICIANDO SINCRONIZAÇÃO: ${dbCliente.nome.toUpperCase()}`);
  console.log(`======================================================`);
  
  // Utiliza as credenciais do banco de dados com fallback global para System User Token
  const ACCESS_TOKEN = dbCliente.meta_access_token || 
                       process.env.META_SYSTEM_USER_TOKEN || 
                       process.env.META_ACCESS_TOKEN_GLOBAL;

  const rawAccountId = dbCliente.meta_ads_account_id;
  const AD_ACCOUNT_ID = rawAccountId?.startsWith('act_') ? rawAccountId : (rawAccountId ? `act_${rawAccountId}` : null);

  if (!ACCESS_TOKEN) {
    console.warn(`⚠️ Token de acesso não configurado para ${dbCliente.nome}. Ignorando...`);
    return;
  }
  if (!AD_ACCOUNT_ID) {
    console.warn(`⚠️ ID de conta Meta Ads não configurado para ${dbCliente.nome}. Ignorando...`);
    return;
  }

  // Obter Timezone
  const timezone = await getAccountTimezone(AD_ACCOUNT_ID, ACCESS_TOKEN);
  const since = getLocalDateNDaysAgo(timezone, daysToSync);
  const until = getLocalDateString(new Date(), timezone);
  console.log(`📅 Janela de Dados (Timezone: ${timezone}): ${since} até ${until} (${daysToSync} dias)`);

  const commonQuery = { access_token: ACCESS_TOKEN, limit: '250' };
  commonQuery.time_range = JSON.stringify({ since, until });

  // 4.1 Buscar campanhas
  console.log(`📡 Buscando campanhas...`);
  const campaignsUrl = graphUrl(`${AD_ACCOUNT_ID}/campaigns`, { access_token: ACCESS_TOKEN, fields: 'id,name,objective', limit: '250' });
  const campaignsList = await fetchMetaPaginated(campaignsUrl);
  const objectiveMap = new Map(campaignsList.map(c => [c.id, c.objective]));
  console.log(`✅ Encontradas ${objectiveMap.size} campanhas.`);

  // 4.2 Buscar adsets
  const adsetsUrl = graphUrl(`${AD_ACCOUNT_ID}/adsets`, { access_token: ACCESS_TOKEN, fields: 'campaign_id,destination_type,optimization_goal', limit: '250' });
  const adsetsList = await fetchMetaPaginated(adsetsUrl);
  const campaignDestinationMap = new Map();
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

  // 4.3 Buscar insights diários das campanhas
  console.log(`📡 Extraindo métricas diárias das campanhas (Padrão Ouro)...`);
  const insightFields = 'campaign_id,campaign_name,spend,impressions,reach,inline_link_click_ctr,clicks,inline_link_clicks,outbound_clicks,actions,action_values';
  const campaignDataUrl = graphUrl(`${AD_ACCOUNT_ID}/insights`, { ...commonQuery, fields: insightFields, level: 'campaign', time_increment: '1' });
  const campaignData = await fetchMetaPaginated(campaignDataUrl);
  console.log(`✅ Extraídas ${campaignData.length} métricas diárias.`);

  // 4.4 Buscar insights diários de anúncios
  console.log(`📡 Extraindo métricas diárias dos criativos...`);
  const adInsightFields = 'ad_id,ad_name,campaign_id,spend,impressions,reach,inline_link_click_ctr,clicks,inline_link_clicks,outbound_clicks,actions,action_values';
  const adInsightDataUrl = graphUrl(`${AD_ACCOUNT_ID}/insights`, { ...commonQuery, fields: adInsightFields, level: 'ad', time_increment: '1' });
  const adInsightData = await fetchMetaPaginated(adInsightDataUrl);
  console.log(`✅ Extraídas ${adInsightData.length} métricas de anúncios.`);

  // 4.5 Buscar metadados de criativos
  console.log(`📡 Resolvendo metadados de mídias (Creative HD Pipeline)...`);
  const adsMetaUrl = graphUrl(`${AD_ACCOUNT_ID}/adcreatives`, { 
    access_token: ACCESS_TOKEN, 
    fields: 'id,image_url,thumbnail_url,image_hash,body,effective_object_story_id', 
    thumbnail_width: 800, 
    thumbnail_height: 800, 
    limit: '250' 
  });
  const adsMetaDataList = await fetchMetaPaginated(adsMetaUrl);
  const creativeMetaMap = new Map(adsMetaDataList.map(m => [String(m.id), m]));

  // Resolver postages e hashes
  const storyIds = adsMetaDataList.map(m => m.effective_object_story_id).filter(id => !!id);
  const storyMetaMap = new Map();
  if (storyIds.length > 0) {
     for (let i = 0; i < storyIds.length; i += 50) {
       const chunk = storyIds.slice(i, i + 50);
       try {
         const res = await fetchMetaWithRetry(graphUrl(``, { ids: chunk.join(','), fields: 'id,full_picture', access_token: ACCESS_TOKEN }));
         Object.values(res).forEach(post => storyMetaMap.set(post.id, post.full_picture));
       } catch (e) {
         console.error(`⚠️ Falha ao resolver imagens de posts:`, e.message);
       }
     }
  }

  const imageHashMap = new Map();
  const uniqueHashes = [...new Set(adsMetaDataList.map(m => m.image_hash).filter(h => !!h))];
  if (uniqueHashes.length > 0) {
     for (let i = 0; i < uniqueHashes.length; i += 50) {
       const chunk = uniqueHashes.slice(i, i + 50);
       try {
         const res = await fetchMetaWithRetry(graphUrl(`${AD_ACCOUNT_ID}/adimages`, { access_token: ACCESS_TOKEN, hashes: JSON.stringify(chunk), fields: 'url,permalink_url,hash' }));
         if (res.data) res.data.forEach(img => { const bestUrl = img.url || img.permalink_url; if (bestUrl) imageHashMap.set(img.hash, bestUrl); });
       } catch (e) {
         console.error(`⚠️ Falha ao resolver hashes de imagens:`, e.message);
       }
     }
  }

  // 4.6 Persistência das Campanhas no DB (Upsert)
  console.log(`💾 Persistindo campanhas e garantindo idempotência...`);
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

  // 4.7 Persistência de Métricas de Campanhas Diárias (Batch)
  console.log(`💾 Persistindo métricas diárias de campanhas...`);
  let countCampaignMetrics = 0;
  await batchProcess(campaignData, 15, async (item) => {
    const camp = localCampMap.get(String(item.campaign_id));
    if (!camp) return;
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

    const isTraffic = (camp.objetivo || '').toUpperCase().includes('TRAFFIC');
    const leadsVal = isTraffic ? 0 : getTrueLeads(item.actions);

    await prisma.metricaCampanha.upsert({
      where: { campanha_id_data: { campanha_id: camp.id, data: dataInsight } },
      update: {
        impressoes: parseInt(item.impressions) || 0, alcance: parseInt(item.reach) || 0, cliques: linkClicks,
        visitas_perfil: totalVisitas, seguidores: getMetric(item.actions, 'onsite_conversion.follow') + getMetric(item.actions, 'page_like'),
        reacoes_sociais: getSocialActions(item.actions), valor_investido: parseFloat(item.spend) || 0,
        conversas_leads: leadsVal, compras: getMetric(item.actions, 'purchase'), valor_compras: getMetric(item.action_values, 'purchase', true)    
      },
      create: {
        campanha_id: camp.id, data: dataInsight,
        impressoes: parseInt(item.impressions) || 0, alcance: parseInt(item.reach) || 0, cliques: linkClicks,
        visitas_perfil: totalVisitas, seguidores: getMetric(item.actions, 'onsite_conversion.follow') + getMetric(item.actions, 'page_like'),
        reacoes_sociais: getSocialActions(item.actions), valor_investido: parseFloat(item.spend) || 0,
        conversas_leads: leadsVal, compras: getMetric(item.actions, 'purchase'), valor_compras: getMetric(item.action_values, 'purchase', true)    
      }
    });
    countCampaignMetrics++;
  });
  console.log(`✅ Gravadas ${countCampaignMetrics} métricas diárias no banco.`);

  // 4.8 Persistência de Métricas de Criativos Diários (Batch)
  if (adInsightData.length > 0) {
    console.log(`💾 Persistindo métricas e mídias de anúncios...`);
    const adsListUrl = graphUrl(`${AD_ACCOUNT_ID}/ads`, { access_token: ACCESS_TOKEN, fields: 'id,creative{id}', limit: '250' });
    const adsList = await fetchMetaPaginated(adsListUrl).catch(() => []);
    const adToCreativeMap = new Map(adsList.map(a => [a.id, a.creative?.id]) || []);

    let countAdMetrics = 0;
    await batchProcess(adInsightData, 15, async (row) => {
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
      const isTraffic = (camp.objetivo || '').toUpperCase().includes('TRAFFIC');
      const leadsVal = isTraffic ? 0 : getTrueLeads(row.actions);

      await prisma.metricaCriativo.upsert({
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
      countAdMetrics++;
    });
    console.log(`✅ Gravadas ${countAdMetrics} métricas de anúncios no banco.`);
  }

  console.log(`🎉 CLIENTE ${dbCliente.nome.toUpperCase()} SINCRONIZADO COM SUCESSO!`);
}

// --- 5. EXECUÇÃO DO ETL GLOBAL ---
async function runAllSyncs() {
  console.log('=' .repeat(80));
  console.log('🚀 INICIANDO PIPELINE DE ETL STANDALONE DO WORKER META ADS');
  console.log('=' .repeat(80));

  const daysToSync = parseInt(process.env.DAYS_TO_SYNC) || 7;
  const startTime = Date.now();

  try {
    const clientes = await prisma.cliente.findMany();

    if (clientes.length === 0) {
      console.log('ℹ️ Nenhum cliente cadastrado no banco de dados.');
    } else {
      console.log(`👥 Encontrados ${clientes.length} clientes cadastrados no banco.`);
      
      // Loop sequencial for...of para respeitar o pool de conexões com o banco
      for (const cliente of clientes) {
        try {
          await syncClient(cliente, daysToSync);
        } catch (e) {
          console.error(`❌ Erro ao sincronizar cliente ${cliente.nome}:`, e.message);
        }
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(80));
    console.log(`🎉 PROCESSO CONCLUÍDO COM SUCESSO EM ${duration}s!`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n💥 Erro crítico no worker:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runAllSyncs();
