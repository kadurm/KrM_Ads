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

async function main() {
  const token = process.env.META_ACCESS_TOKEN_GLOBAL;
  const campaignId = '120246076065370725'; // Dr. Yuri Telles Traffic Campaign
  
  // Fetch campaign details
  const campUrl = `https://graph.facebook.com/v21.0/${campaignId}?access_token=${token}&fields=id,name,objective,status`;
  const campRes = await fetch(campUrl);
  const campJson = await campRes.json();
  console.log('=== CAMPAIGN CONFIG ===');
  console.dir(campJson, { depth: null });

  // Fetch adsets details
  const adsetsUrl = `https://graph.facebook.com/v21.0/${campaignId}/adsets?access_token=${token}&fields=id,name,destination_type,optimization_goal`;
  const adsetsRes = await fetch(adsetsUrl);
  const adsetsJson = await adsetsRes.json();
  console.log('\n=== ADSETS CONFIG ===');
  console.dir(adsetsJson, { depth: null });

  // Fetch campaign insights
  const query = new URLSearchParams({
    access_token: token,
    fields: 'campaign_id,campaign_name,spend,inline_link_clicks,outbound_clicks,actions',
    time_range: JSON.stringify({ since: '2026-05-01', until: '2026-05-31' }),
  });
  const url = `https://graph.facebook.com/v21.0/${campaignId}/insights?${query}`;
  const res = await fetch(url);
  const insights = await res.json();
  console.log('\n=== CAMPAIGN INSIGHTS (MAY 2026) ===');
  console.dir(insights.data?.[0], { depth: null });
}

main().catch(console.error);
