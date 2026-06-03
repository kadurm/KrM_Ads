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
  console.error(e);
}

function graphUrl(path, query) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });
  return url.toString();
}

async function main() {
  const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN_GLOBAL;
  const CAMP_ID = '120240974052060488'; // We can search for the campaign ID in the DB first
  
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  const camp = await prisma.campanha.findFirst({
    where: { nome_gerado: { contains: 'Shopee' } }
  });

  if (!camp) {
    console.error('Campanha Shopee não encontrada no banco.');
    process.exit(1);
  }

  console.log(`Encontrada campanha Shopee no DB: ${camp.nome_gerado} (Meta ID: ${camp.meta_id})`);

  const url = graphUrl(`${camp.meta_id}/insights`, {
    access_token: ACCESS_TOKEN,
    fields: 'spend,actions,action_values',
    time_range: JSON.stringify({ since: '2026-05-01', until: '2026-05-31' })
  });

  console.log(`📡 Buscando dados de ações direto da Meta...`);
  const res = await fetch(url);
  const json = await res.json();

  console.log('\n=== RAW ACTIONS FROM META ===');
  if (json.data && json.data.length > 0) {
    console.log(`Investimento: R$ ${json.data[0].spend}`);
    console.log('Ações Registradas:');
    console.dir(json.data[0].actions, { depth: null });
  } else {
    console.log('Nenhum insight retornado pela Meta para essa campanha.', json);
  }

  await prisma.$disconnect();
}

main();
