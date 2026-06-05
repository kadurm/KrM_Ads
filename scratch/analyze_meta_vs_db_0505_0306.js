const fs = require('fs');
const path = require('path');

// Carrega as variáveis do arquivo .env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
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
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const slug = 'solutionplace';
  const cliente = await prisma.cliente.findUnique({ where: { slug } });
  if (!cliente) {
    console.error('Cliente não encontrado.');
    return;
  }

  const token = process.env.META_ACCESS_TOKEN_GLOBAL || cliente.meta_access_token;
  const rawAccountId = process.env.META_AD_ACCOUNT_ID_SOLUTIONPLACE || cliente.meta_ads_account_id;
  const accountId = rawAccountId.startsWith('act_') ? rawAccountId : `act_${rawAccountId}`;

  // Período solicitado pelo usuário (05/05/2026 a 03/06/2026)
  const since = '2026-05-05';
  const until = '2026-06-03';
  const startDate = new Date(`${since}T00:00:00.000Z`);
  const endDate = new Date(`${until}T23:59:59.999Z`);

  console.log(`=== ANÁLISE DE COMPARAÇÃO DE 05/05/2026 A 03/06/2026 ===\n`);

  // 1. Buscar do Banco de Dados
  console.log(`--- DADOS DO BANCO DE DADOS LOCAL (DB) ---`);
  const dbCampanhas = await prisma.campanha.findMany({
    where: { cliente_id: cliente.id },
    include: {
      metricas: {
        where: { data: { gte: startDate, lte: endDate } }
      }
    }
  });

  let totalDbSpend = 0;
  let totalDbLeads = 0;
  let totalDbImpressions = 0;
  let totalDbClicks = 0;
  const dbData = {};

  dbCampanhas.forEach(camp => {
    const spend = camp.metricas.reduce((sum, m) => sum + Number(m.valor_investido), 0);
    const impressions = camp.metricas.reduce((sum, m) => sum + m.impressoes, 0);
    const clicks = camp.metricas.reduce((sum, m) => sum + m.cliques, 0);
    const leads = camp.metricas.reduce((sum, m) => sum + m.conversas_leads, 0);

    if (spend > 0 || impressions > 0) {
      console.log(`Campanha: ${camp.nome_gerado} (${camp.meta_id})`);
      console.log(`  - Investido: R$ ${spend.toFixed(2)} | Leads: ${leads} | Impressões: ${impressions} | Cliques: ${clicks}`);
      totalDbSpend += spend;
      totalDbLeads += leads;
      totalDbImpressions += impressions;
      totalDbClicks += clicks;

      dbData[camp.meta_id] = { spend, leads, impressions, clicks, nome: camp.nome_gerado };
    }
  });
  console.log(`TOTAL DB: Spend = R$ ${totalDbSpend.toFixed(2)} | Leads = ${totalDbLeads} | Impressões = ${totalDbImpressions} | Cliques = ${totalDbClicks}\n`);

  // 2. Buscar diretamente da Meta API
  console.log(`--- DADOS DIRETOS DA META API ---`);
  const time_range = JSON.stringify({ since, until });
  const url = `https://graph.facebook.com/v21.0/${accountId}/insights?access_token=${token}&time_range=${encodeURIComponent(time_range)}&fields=campaign_id,campaign_name,spend,impressions,clicks,actions&level=campaign&limit=500`;

  try {
    const response = await fetch(url);
    const result = await response.json();
    
    if (result.error) {
      console.error('Erro Meta API:', result.error);
      return;
    }

    const rows = result.data || [];
    let totalMetaSpend = 0;
    let totalMetaLeads = 0;
    let totalMetaImpressions = 0;
    let totalMetaClicks = 0;
    const metaData = {};

    rows.forEach(item => {
      const spend = parseFloat(item.spend || 0);
      const impressions = parseInt(item.impressions || 0);
      const clicks = parseInt(item.clicks || 0);
      
      let leads = 0;
      const actions = item.actions || [];
      const messageAction = actions.find(a => a.action_type === 'onsite_conversion.messaging_first_reply_started' || a.action_type === 'messaging_first_reply_started');
      if (messageAction) {
        leads = parseInt(messageAction.value || 0);
      }

      console.log(`Campanha: ${item.campaign_name} (${item.campaign_id})`);
      console.log(`  - Investido: R$ ${spend.toFixed(2)} | Leads: ${leads} | Impressões: ${impressions} | Cliques: ${clicks}`);
      totalMetaSpend += spend;
      totalMetaLeads += leads;
      totalMetaImpressions += impressions;
      totalMetaClicks += clicks;

      metaData[item.campaign_id] = { spend, leads, impressions, clicks, nome: item.campaign_name };
    });
    console.log(`TOTAL META API: Spend = R$ ${totalMetaSpend.toFixed(2)} | Leads = ${totalMetaLeads} | Impressões = ${totalMetaImpressions} | Cliques = ${totalMetaClicks}\n`);

    // 3. Cruzar dados para identificar a diferença
    console.log(`--- COMPARAÇÃO DE DIVERGÊNCIAS (DB vs Meta API) ---`);
    const allCampaignIds = new Set([...Object.keys(dbData), ...Object.keys(metaData)]);

    allCampaignIds.forEach(id => {
      const db = dbData[id] || { spend: 0, leads: 0, impressions: 0, clicks: 0, nome: 'Não cadastrada no DB' };
      const meta = metaData[id] || { spend: 0, leads: 0, impressions: 0, clicks: 0, nome: 'Não retornada na Meta API' };

      const diffSpend = db.spend - meta.spend;
      const diffLeads = db.leads - meta.leads;

      console.log(`Campanha: ${db.nome || meta.nome} (${id})`);
      console.log(`  - Gasto: DB = R$ ${db.spend.toFixed(2)} | Meta = R$ ${meta.spend.toFixed(2)} | Diferença = R$ ${diffSpend.toFixed(2)}`);
      console.log(`  - Leads: DB = ${db.leads} | Meta = ${meta.leads} | Diferença = ${diffLeads}`);
    });

  } catch (error) {
    console.error('Erro na requisição da Meta API:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
