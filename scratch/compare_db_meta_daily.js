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
  
  const token = process.env.META_ACCESS_TOKEN_GLOBAL || cliente.meta_access_token;
  const campaignMetaId = '120245136929540488'; // Campanha [09][KrM][ABO][Message]
  
  // Buscar no banco
  const dbMetricas = await prisma.metricaCampanha.findMany({
    where: {
      campanha: { meta_id: campaignMetaId },
      data: {
        gte: new Date('2026-05-06T00:00:00.000Z'),
        lte: new Date('2026-06-04T23:59:59.999Z')
      }
    },
    orderBy: { data: 'asc' }
  });

  console.log(`=== Comparando Métricas Diárias para a Campanha [09] ===`);
  console.log(`Registros no DB: ${dbMetricas.length}`);
  
  const dbByDate = {};
  dbMetricas.forEach(m => {
    const dStr = m.data.toISOString().split('T')[0];
    dbByDate[dStr] = {
      spend: Number(m.valor_investido),
      leads: m.conversas_leads,
      impressions: m.impressoes
    };
  });

  // Buscar da Meta API dia a dia
  const since = '2026-05-06';
  const until = '2026-06-04';
  const time_range = JSON.stringify({ since, until });
  const url = `https://graph.facebook.com/v21.0/${campaignMetaId}/insights?access_token=${token}&time_range=${encodeURIComponent(time_range)}&fields=spend,impressions,clicks,actions&time_increment=1&limit=500`;

  try {
    const res = await fetch(url);
    const result = await res.json();
    if (result.error) {
      console.error('Erro Meta:', result.error);
      return;
    }

    const metaData = result.data || [];
    console.log(`Registros na Meta API: ${metaData.length}`);

    console.log(`\nData       | DB Spend   | Meta Spend  | DB Leads | Meta Leads | DB Imp   | Meta Imp`);
    console.log(`-----------------------------------------------------------------------------------------`);

    // Cruzando por data
    const allDates = new Set([...Object.keys(dbByDate), ...metaData.map(m => m.date_start)]);
    
    Array.from(allDates).sort().forEach(date => {
      const db = dbByDate[date] || { spend: 0, leads: 0, impressions: 0 };
      const metaItem = metaData.find(m => m.date_start === date);
      
      let metaSpend = 0;
      let metaLeads = 0;
      let metaImp = 0;

      if (metaItem) {
        metaSpend = parseFloat(metaItem.spend || 0);
        metaImp = parseInt(metaItem.impressions || 0);
        const actions = metaItem.actions || [];
        // Procurar por conversas iniciadas nas actions
        const messageAction = actions.find(a => a.action_type === 'onsite_conversion.messaging_first_reply_started' || a.action_type === 'messaging_first_reply_started');
        if (messageAction) {
          metaLeads = parseInt(messageAction.value || 0);
        }
      }

      console.log(`${date} | R$ ${db.spend.toFixed(2).padStart(7)} | R$ ${metaSpend.toFixed(2).padStart(8)} | ${String(db.leads).padStart(8)} | ${String(metaLeads).padStart(10)} | ${String(db.impressions).padStart(8)} | ${String(metaImp).padStart(8)}`);
    });

  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
