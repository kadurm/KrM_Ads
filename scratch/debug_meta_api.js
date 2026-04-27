const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
// native fetch is available in Node 18+

async function debugSyncVerbose() {
  const cliente = 'Solution Place';
  const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN_Solution;
  const rawId = process.env.META_AD_ACCOUNT_ID_Solution;
  const AD_ACCOUNT_ID = rawId.startsWith('act_') ? rawId : `act_${rawId}`;
  
  if (!ACCESS_TOKEN || !AD_ACCOUNT_ID) {
    console.error('Missing env vars');
    process.exit(1);
  }

  // 1. Get some ad IDs with spend
  const url = `https://graph.facebook.com/v21.0/${AD_ACCOUNT_ID}/insights?access_token=${ACCESS_TOKEN}&level=ad&date_preset=last_30d&fields=ad_id,ad_name&limit=5`;
  const res = await fetch(url);
  const data = await res.json();
  
  if (!data.data) {
    console.error('No insights data', data);
    process.exit(1);
  }

  const adIds = data.data.map(ad => ad.ad_id);
  console.log('Testing for Ad IDs:', adIds);

  // 2. Fetch creative info
  const creativeUrl = `https://graph.facebook.com/v21.0/?ids=${adIds.join(',')}&fields=id,creative{id,image_url,thumbnail_url.width(800).height(800),image_hash}&access_token=${ACCESS_TOKEN}`;
  const res2 = await fetch(creativeUrl);
  const creativeData = await res2.json();
  
  console.log('Creative Data from Meta:');
  console.log(JSON.stringify(creativeData, null, 2));

  process.exit(0);
}

debugSyncVerbose();
