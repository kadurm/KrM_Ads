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
  const campaignId = '120249480706290746'; // Direito Direto
  
  const query = new URLSearchParams({
    access_token: token,
    fields: 'campaign_id,campaign_name,spend,inline_link_clicks,outbound_clicks,actions',
    time_range: JSON.stringify({ since: '2026-05-10', until: '2026-05-14' }),
    time_increment: '1',
    limit: '100'
  });

  const url = `https://graph.facebook.com/v21.0/${campaignId}/insights?${query}`;
  const res = await fetch(url);
  const json = await res.json();

  console.log('=== RAW META DAILY INSIGHTS (MAY 10 - 14) ===');
  console.dir(json.data, { depth: null });
}

main().catch(console.error);
