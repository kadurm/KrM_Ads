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
  console.warn('Erro ao carregar .env:', e.message);
}

async function getCampaignInsights(campaignId) {
  const token = process.env.META_ACCESS_TOKEN_GLOBAL;
  const query = new URLSearchParams({
    access_token: token,
    fields: 'campaign_id,campaign_name,spend,impressions,reach,inline_link_clicks,outbound_clicks,actions',
    time_range: JSON.stringify({ since: '2026-05-01', until: '2026-05-31' }),
  });

  const url = `https://graph.facebook.com/v21.0/${campaignId}/insights?${query}`;
  const res = await fetch(url);
  const json = await res.json();
  return json.data ? json.data[0] : null;
}

async function main() {
  const ids = ['120249480706290746', '120252358624940746'];
  for (const id of ids) {
    console.log(`\n=== CAMPAIGN ID: ${id} ===`);
    const insights = await getCampaignInsights(id);
    console.dir(insights, { depth: null });
  }
}

main().catch(console.error);
