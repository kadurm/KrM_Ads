const fs = require('fs');
const path = require('path');
const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
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
process.env.DATABASE_URL = process.env.DIRECT_URL;

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cliente = await prisma.cliente.findFirst({
    where: { nome: { contains: 'Mind', mode: 'insensitive' } }
  });

  if (!cliente) {
    console.log('Cliente Mind não encontrado.');
    return;
  }

  // 1. Check DB for all creatives for this client in May
  const criativos = await prisma.criativo.findMany({
    where: { campanha: { cliente_id: cliente.id } },
    include: {
      metricas: {
        where: { data: { gte: new Date('2026-05-01'), lte: new Date('2026-05-31') } }
      }
    }
  });

  console.log(`\n=== CRIATIVOS NO BANCO DE DADOS (${criativos.length}) ===`);
  criativos.forEach(c => {
    const totalImpressoes = c.metricas.reduce((sum, m) => sum + m.impressoes, 0);
    const maxAlcance = c.metricas.reduce((max, m) => Math.max(max, m.alcance), 0);
    const sumAlcance = c.metricas.reduce((sum, m) => sum + m.alcance, 0);
    console.log(`- ${c.nome_anuncio} (ID: ${c.meta_ad_id})`);
    console.log(`  Métricas cadastradas (dias): ${c.metricas.length}`);
    console.log(`  Impressões (Soma): ${totalImpressoes}`);
    console.log(`  Alcance (Math.max): ${maxAlcance}`);
    console.log(`  Alcance (Soma Simples): ${sumAlcance}`);
  });

  // 2. Fetch directly from Meta API (Account Level)
  const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN_GLOBAL || cliente.meta_access_token;
  const AD_ACCOUNT_ID = `act_${cliente.meta_ads_account_id}`;
  
  console.log('\n=== BUSCANDO DADOS GLOBAIS NA API META ===');
  const accountUrl = `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/insights?time_range={"since":"2026-05-01","until":"2026-05-31"}&level=account&fields=reach,impressions&access_token=${ACCESS_TOKEN}`;
  const accountRes = await fetch(accountUrl);
  const accountData = await accountRes.json();
  console.log('Account Insights:', accountData.data?.[0]);

  // 3. Fetch directly from Meta API (Ad Level)
  console.log('\n=== BUSCANDO DADOS DE ADS NA API META ===');
  const adUrl = `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/insights?time_range={"since":"2026-05-01","until":"2026-05-31"}&level=ad&fields=ad_name,reach,impressions&access_token=${ACCESS_TOKEN}`;
  const adRes = await fetch(adUrl);
  const adData = await adRes.json();
  if (adData.data) {
    adData.data.forEach(ad => {
      console.log(`- ${ad.ad_name} | Alcance (API Real): ${ad.reach} | Impressões: ${ad.impressions}`);
    });
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
