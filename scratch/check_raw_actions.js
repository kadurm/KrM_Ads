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
    where: { nome: { contains: 'Oratória', mode: 'insensitive' } }
  });

  if (!cliente) {
    console.log('Cliente não encontrado.');
    return;
  }

  const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN_GLOBAL || cliente.meta_access_token;
  const AD_ACCOUNT_ID = `act_${cliente.meta_ads_account_id}`;
  
  const url = `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/insights?time_range={"since":"2026-05-01","until":"2026-05-31"}&level=campaign&fields=campaign_name,actions&access_token=${ACCESS_TOKEN}`;
  
  const res = await fetch(url);
  const data = await res.json();
  
  if (data.error) {
    console.log('Meta API Error:', data.error);
    return;
  }
  
  const campanha = data.data.find(c => c.campaign_name.includes('[03][KrM][Message][Curso 20/21 - Maio]'));
  if (campanha) {
    console.log('Ações brutas da API:', JSON.stringify(campanha.actions, null, 2));
  } else {
    console.log('Campanha não encontrada na API Meta para este mês.');
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
