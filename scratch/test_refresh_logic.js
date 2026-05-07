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
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function graphUrl(path, query) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });
  return url.toString();
}

async function main() {
  const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN_GLOBAL;
  const AD_ACCOUNT_ID = 'act_861875509414758';

  // Teste 1: batch /?ids=... (o que meu código faz)
  console.log('=== TESTE 1: Batch /?ids=... ===');
  const adIds = ['120240228881900488', '120240614423030488'];
  const url1 = graphUrl('', {
    ids: adIds.join(','),
    fields: 'creative{image_url,thumbnail_url,effective_object_story_id,image_hash}',
    access_token: ACCESS_TOKEN
  });
  const res1 = await fetch(url1);
  const data1 = await res1.json();
  console.log('Resposta COMPLETA:', JSON.stringify(data1, null, 2).substring(0, 2000));

  // Teste 2: Fetch individual de um ad
  console.log('\n=== TESTE 2: Fetch individual /{ad_id} ===');
  const url2 = graphUrl('120240228881900488', {
    fields: 'creative{image_url,thumbnail_url,effective_object_story_id,image_hash}',
    access_token: ACCESS_TOKEN
  });
  const res2 = await fetch(url2);
  const data2 = await res2.json();
  console.log('Resposta:', JSON.stringify(data2, null, 2).substring(0, 1000));

  // Teste 3: Abordagem do POST sync - /adcreatives direto
  console.log('\n=== TESTE 3: /adcreatives (abordagem do POST sync) ===');
  const url3 = graphUrl(`${AD_ACCOUNT_ID}/adcreatives`, {
    access_token: ACCESS_TOKEN,
    fields: 'id,image_url,thumbnail_url,image_hash,body,effective_object_story_id',
    thumbnail_width: 800,
    thumbnail_height: 800,
    limit: '5'
  });
  const res3 = await fetch(url3);
  const data3 = await res3.json();
  console.log('Resposta (primeiros 2 criativos):');
  (data3.data || []).slice(0, 2).forEach(c => {
    console.log(`  Creative ID: ${c.id}`);
    console.log(`  image_url: ${c.image_url ? c.image_url.substring(0, 100) + '...' : 'NULL'}`);
    console.log(`  thumbnail_url: ${c.thumbnail_url ? c.thumbnail_url.substring(0, 100) + '...' : 'NULL'}`);
    console.log(`  image_hash: ${c.image_hash || 'NULL'}`);
    console.log(`  effective_object_story_id: ${c.effective_object_story_id || 'NULL'}`);
    console.log('');
  });

  // Teste 4: Se thumbnail_url está acessível  
  if (data3.data?.[0]?.thumbnail_url) {
    console.log('=== TESTE 4: Acessibilidade da thumbnail_url fresca ===');
    const testUrl = data3.data[0].thumbnail_url;
    console.log('URL:', testUrl.substring(0, 100) + '...');
    const testRes = await fetch(testUrl, { method: 'HEAD' });
    console.log(`Status: ${testRes.status} ${testRes.statusText}`);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
