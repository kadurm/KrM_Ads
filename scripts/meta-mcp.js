/**
 * KrM_Ads - Meta Ads & Prisma DB Custom MCP Server
 * 
 * Este script implementa a especificação do Model Context Protocol (MCP) em Node.js puro (sem dependências)
 * via stdin/stdout com JSON-RPC 2.0.
 * Ele permite que o assistente Antigravity chame ferramentas nativas para interagir com a Meta Ads API
 * e o banco de dados Supabase em tempo real.
 * 
 * IMPORTANTE: Todos os logs de depuração devem ser enviados para stderr (console.error) para evitar corromper
 * a stream JSON-RPC em stdout.
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
    console.error('[MCP] Variáveis do arquivo .env carregadas com sucesso.');
  }
} catch (e) {
  console.error('[MCP] Erro ao carregar .env:', e.message);
}

if (process.env.DIRECT_URL) {
  console.error('[MCP] Usando DIRECT_URL para conexões com o banco.');
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

// Inicialização tardia do Prisma para evitar falhas imediatas se o banco estiver indisponível
let prismaInstance = null;
function getPrisma() {
  if (!prismaInstance) {
    const { PrismaClient } = require('@prisma/client');
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
}

// --- 2. AUXILIARES DE META ADS API ---
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

// --- 3. PROVEDOR DE CREDENCIAIS ---
function getCredentials(clienteName) {
  const slug = clienteName.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '');
  const shortName = clienteName.normalize('NFD').replace(/[\u0300-\u036f]/g, "").split(' ')[0].replace(/[^a-zA-Z0-9]/g, '');
  
  const ACCESS_TOKEN = process.env[`META_ACCESS_TOKEN_${slug.toUpperCase()}`] || 
                       process.env[`META_ACCESS_TOKEN_${slug}`] ||
                       process.env[`META_ACCESS_TOKEN_${shortName.toUpperCase()}`] ||
                       process.env[`META_ACCESS_TOKEN_${shortName}`] ||
                       process.env.META_ACCESS_TOKEN_GLOBAL;

  const rawAccountId = process.env[`META_AD_ACCOUNT_ID_${slug.toUpperCase()}`] || 
                       process.env[`META_AD_ACCOUNT_ID_${slug}`] ||
                       process.env[`META_AD_ACCOUNT_ID_${shortName.toUpperCase()}`] ||
                       process.env[`META_AD_ACCOUNT_ID_${shortName}`];

  const AD_ACCOUNT_ID = rawAccountId?.startsWith('act_') ? rawAccountId : (rawAccountId ? `act_${rawAccountId}` : null);

  return { token: ACCESS_TOKEN, accountId: AD_ACCOUNT_ID, slug, shortName };
}

// --- 4. IMPLEMENTAÇÃO DAS FERRAMENTAS MCP ---

// Ferramenta 1: Buscar métricas ao vivo da Meta (Sem salvar no DB, ideal para consultas e análises instantâneas)
async function getLiveInsights(cliente, days = 30) {
  const { token, accountId } = getCredentials(cliente);
  if (!token || !accountId) {
    return `Credenciais não encontradas no arquivo .env para o cliente '${cliente}'.`;
  }

  const today = new Date();
  const pastDate = new Date();
  pastDate.setDate(today.getDate() - days);
  const since = pastDate.toISOString().split('T')[0];
  const until = today.toISOString().split('T')[0];

  const query = {
    access_token: token,
    fields: 'campaign_id,campaign_name,spend,impressions,reach,inline_link_click_ctr,clicks,inline_link_clicks,actions,action_values',
    level: 'campaign',
    time_range: JSON.stringify({ since, until }),
    limit: '100'
  };

  const url = graphUrl(`${accountId}/insights`, query);
  const data = await fetchMetaInsights(url);

  if (data.length === 0) {
    return `Nenhuma métrica encontrada para ${cliente} no período de ${since} a ${until}.`;
  }

  const summary = data.map(c => {
    const spend = parseFloat(c.spend) || 0;
    const clicks = parseInt(c.clicks) || 0;
    const impressions = parseInt(c.impressions) || 0;
    const leads = getTrueLeads(c.actions);
    
    return {
      campaign_id: c.campaign_id,
      campaign_name: c.campaign_name,
      spend: `R$ ${spend.toFixed(2)}`,
      impressions,
      reach: parseInt(c.reach) || 0,
      clicks,
      ctr: `${(parseFloat(c.inline_link_click_ctr) || 0).toFixed(2)}%`,
      leads,
      cpl: leads > 0 ? `R$ ${(spend / leads).toFixed(2)}` : 'R$ 0.00',
      cpc: clicks > 0 ? `R$ ${(spend / clicks).toFixed(2)}` : 'R$ 0.00'
    };
  });

  const totals = data.reduce((acc, c) => {
    const spend = parseFloat(c.spend) || 0;
    const clicks = parseInt(c.clicks) || 0;
    const impressions = parseInt(c.impressions) || 0;
    const leads = getTrueLeads(c.actions);
    
    acc.spend += spend;
    acc.impressions += impressions;
    acc.clicks += clicks;
    acc.leads += leads;
    return acc;
  }, { spend: 0, impressions: 0, clicks: 0, leads: 0 });

  const finalResult = {
    cliente,
    periodo: `${since} ate ${until}`,
    resumo_campanhas: summary,
    totais_gerais: {
      investimento_total: `R$ ${totals.spend.toFixed(2)}`,
      impressoes_totais: totals.impressions,
      cliques_totais: totals.clicks,
      leads_totais: totals.leads,
      cpl_medio: totals.leads > 0 ? `R$ ${(totals.spend / totals.leads).toFixed(2)}` : 'R$ 0.00',
      cpc_medio: totals.clicks > 0 ? `R$ ${(totals.spend / totals.clicks).toFixed(2)}` : 'R$ 0.00',
      ctr_medio: totals.impressions > 0 ? `${((totals.clicks / totals.impressions) * 100).toFixed(2)}%` : '0.00%'
    }
  };

  return JSON.stringify(finalResult, null, 2);
}

// Ferramenta 2: Sincronizar dados diretamente para o banco de dados Supabase via Prisma
async function syncDatabase(cliente, days = 30) {
  try {
    const { token, accountId, slug, shortName } = getCredentials(cliente);
    if (!token || !accountId) {
      return `❌ Credenciais não encontradas para o cliente '${cliente}'.`;
    }

    const prisma = getPrisma();
    
    // Validar se cliente existe no banco
    let dbCliente = await prisma.cliente.findFirst({
      where: {
        OR: [
          { nome: { equals: cliente, mode: 'insensitive' } },
          { slug: { equals: slug, mode: 'insensitive' } }
        ]
      }
    });

    if (!dbCliente) {
      console.error(`[MCP] Criando cliente '${cliente}' no banco...`);
      dbCliente = await prisma.cliente.create({
        data: {
          nome: cliente,
          slug: slug,
          meta_ads_account_id: accountId,
          meta_access_token: token,
          insights: `# Contexto Automático via MCP`
        }
      });
    }

    const today = new Date();
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - days);
    const since = pastDate.toISOString().split('T')[0];
    const until = today.toISOString().split('T')[0];

    const commonQuery = { access_token: token, limit: '1000', time_range: JSON.stringify({ since, until }) };

    // Sincronizando campanhas
    console.error(`[MCP] Buscando dados de campanhas...`);
    const metaCampsRes = await fetch(graphUrl(`${accountId}/campaigns`, { access_token: token, fields: 'id,name,objective', limit: '1000' }));
    const metaCampsData = await metaCampsRes.json();
    const objectiveMap = new Map(metaCampsData.data?.map(c => [c.id, c.objective]) || []);

    const campaignData = await fetchMetaInsights(graphUrl(`${accountId}/insights`, { ...commonQuery, fields: 'campaign_id,campaign_name,spend,impressions,reach,inline_link_click_ctr,clicks,inline_link_clicks,outbound_clicks,actions,action_values', level: 'campaign', time_increment: '1' }));
    
    // Inserindo no DB
    console.error(`[MCP] Salvando campanhas no banco (${campaignData.length} registros)...`);
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

    // Inserindo métricas diárias
    let countMetrics = 0;
    for (const item of campaignData) {
      const camp = localCampMap.get(String(item.campaign_id));
      if (!camp) continue;
      const dataInsight = new Date(item.date_start + 'T00:00:00.000Z');
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
          reacoes_sociais: getMetric(item.actions, 'post_reaction') + getMetric(item.actions, 'comment') + getMetric(item.actions, 'share'),
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
          reacoes_sociais: getMetric(item.actions, 'post_reaction') + getMetric(item.actions, 'comment') + getMetric(item.actions, 'share'),
          valor_investido: parseFloat(item.spend) || 0,
          conversas_leads: getTrueLeads(item.actions),
          compras: getMetric(item.actions, 'purchase'),
          valor_compras: getMetric(item.action_values, 'purchase', true)    
        }
      });
      countMetrics++;
    }

    return `✅ Sincronização concluída para '${cliente}'.\n- Campanhas atualizadas: ${uniqueCampaigns.length}\n- Linhas de métricas salvas: ${countMetrics}`;
  } catch (error) {
    return `❌ Erro durante a sincronização via MCP: ${error.message}`;
  } finally {
    if (prismaInstance) await prismaInstance.$disconnect();
  }
}

// Ferramenta 3: Verificar status de integridade do banco de dados local
async function getDatabaseStatus() {
  try {
    const prisma = getPrisma();
    const clientes = await prisma.cliente.findMany({ select: { nome: true, _count: { select: { campanhas: true } } } });
    const totalCampanhas = await prisma.campanha.count();
    const totalMetricas = await prisma.metricaCampanha.count();
    const totalCriativos = await prisma.criativo.count();

    const status = {
      conexao: 'ATIVA (DIRECT_URL)',
      clientes: clientes.map(c => ({ nome: c.nome, campanhas_cadastradas: c._count.campanhas })),
      total_campanhas: totalCampanhas,
      total_criativos: totalCriativos,
      total_linhas_metricas: totalMetricas
    };

    return JSON.stringify(status, null, 2);
  } catch (error) {
    return `❌ Erro de conexão com o banco de dados Supabase: ${error.message}`;
  } finally {
    if (prismaInstance) await prismaInstance.$disconnect();
  }
}

// --- 5. LOOP DE COMUNICAÇÃO JSON-RPC (STDIN / STDOUT) ---
const toolsList = [
  {
    name: 'meta_get_live_insights',
    description: 'Busca métricas ao vivo da API do Meta Ads em tempo real (spend, impressions, reach, leads, CTR, CPC, CPL) sem salvar no banco de dados. Útil para diagnósticos rápidos e relatórios instantâneos via chat.',
    inputSchema: {
      type: 'object',
      properties: {
        cliente: { type: 'string', description: 'Nome do cliente (ex: "Solution Place", "Carretel Aviamentos")' },
        days: { type: 'number', description: 'Janela de dias para análise (default: 30)' }
      },
      required: ['cliente']
    }
  },
  {
    name: 'meta_sync_db',
    description: 'Executa a sincronização completa do Padrão Ouro de Extração da Meta Ads API para o banco de dados Supabase do projeto. Atualiza campanhas, métricas diárias, leads reais e valores históricos.',
    inputSchema: {
      type: 'object',
      properties: {
        cliente: { type: 'string', description: 'Nome do cliente (ex: "Solution Place")' },
        days: { type: 'number', description: 'Quantidade de dias históricos a sincronizar (default: 30)' }
      },
      required: ['cliente']
    }
  },
  {
    name: 'meta_get_db_status',
    description: 'Valida a integridade da conexão do banco de dados local (Supabase) e lista a quantidade de clientes, campanhas, criativos e métricas atualmente sincronizadas.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

let buffer = '';

process.stdin.on('data', chunk => {
  buffer += chunk.toString();
  let lineEndIdx;
  
  while ((lineEndIdx = buffer.indexOf('\n')) !== -1) {
    const line = buffer.substring(0, lineEndIdx).trim();
    buffer = buffer.substring(lineEndIdx + 1);
    
    if (line) {
      handleRequest(line).catch(err => {
        console.error('[MCP] Request handler error:', err);
      });
    }
  }
});

async function handleRequest(line) {
  let request;
  try {
    request = JSON.parse(line);
  } catch (err) {
    sendError(null, -32700, 'Parse error');
    return;
  }

  const { method, id, params } = request;
  console.error(`[MCP] Recebido request: ${method} (id: ${id})`);

  if (method === 'initialize') {
    sendResponse(id, {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {}
      },
      serverInfo: {
        name: 'meta-ads-mcp',
        version: '1.0.0'
      }
    });
  } 
  else if (method === 'notifications/initialized') {
    console.error('[MCP] Handshake completo e inicializado.');
  }
  else if (method === 'tools/list') {
    sendResponse(id, { tools: toolsList });
  } 
  else if (method === 'tools/call') {
    const { name, arguments: args } = params;
    console.error(`[MCP] Chamando ferramenta: ${name}`);
    
    try {
      let resultText = '';
      if (name === 'meta_get_live_insights') {
        resultText = await getLiveInsights(args.cliente, args.days);
      } else if (name === 'meta_sync_db') {
        resultText = await syncDatabase(args.cliente, args.days);
      } else if (name === 'meta_get_db_status') {
        resultText = await getDatabaseStatus();
      } else {
        sendError(id, -32601, `Tool not found: ${name}`);
        return;
      }
      
      sendResponse(id, {
        content: [
          {
            type: 'text',
            text: resultText
          }
        ]
      });
    } catch (err) {
      console.error(`[MCP] Erro ao executar ${name}:`, err);
      sendResponse(id, {
        content: [
          {
            type: 'text',
            text: `❌ Falha ao executar ferramenta: ${err.message}`
          }
        ],
        isError: true
      });
    }
  } 
  else {
    sendError(id, -32601, 'Method not found');
  }
}

function sendResponse(id, result) {
  const response = {
    jsonrpc: '2.0',
    id,
    result
  };
  process.stdout.write(JSON.stringify(response) + '\n');
}

function sendError(id, code, message) {
  const response = {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message
    }
  };
  process.stdout.write(JSON.stringify(response) + '\n');
}
