const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

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
  console.warn(e.message);
}

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

async function main() {
  const metaAdId = '120244553862570232'; // AD[05/05/26]
  
  // 1. Query DB records
  const dbMetrics = await prisma.metricaCriativo.findMany({
    where: { criativo: { meta_ad_id: metaAdId } },
    orderBy: { data: 'asc' }
  });

  console.log('DB Creative Metrics for May/June:');
  dbMetrics.forEach(m => {
    console.log(`${m.data.toISOString().split('T')[0]}: spend=${m.valor_investido}, leads=${m.leads}`);
  });

  // 2. Query Meta API
  const token = process.env.META_ACCESS_TOKEN_GLOBAL;
  const since = '2026-05-01';
  const until = '2026-05-31';

  const query = new URLSearchParams({
    access_token: token,
    fields: 'ad_id,ad_name,spend,impressions,reach,inline_link_clicks,actions',
    time_range: JSON.stringify({ since, until }),
    level: 'ad',
    time_increment: '1'
  });

  const url = `https://graph.facebook.com/v21.0/${metaAdId}/insights?${query}`;
  const res = await fetch(url);
  const json = await res.json();

  console.log('\nMeta API Daily Actions for May:');
  if (json.data) {
    json.data.forEach(item => {
      console.log(`\nDate: ${item.date_start} | spend=${item.spend}`);
      if (item.actions) {
        item.actions.forEach(act => {
          console.log(`  - ${act.action_type}: ${act.value}`);
        });
      } else {
        console.log('  No actions');
      }
    });
  } else {
    console.log('No Meta API data returned. Error:', json);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
