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

async function main() {
  const token = process.env.META_ACCESS_TOKEN_GLOBAL;
  const campaignId = '120249480706290746'; // Direito Direto Traffic Campaign
  
  // Query adset insights
  const adsetQuery = new URLSearchParams({
    access_token: token,
    fields: 'adset_id,adset_name,spend,inline_link_clicks,outbound_clicks,actions',
    time_range: JSON.stringify({ since: '2026-05-01', until: '2026-05-31' }),
  });
  const adsetUrl = `https://graph.facebook.com/v21.0/${campaignId}/insights?level=adset&${adsetQuery}`;
  const adsetRes = await fetch(adsetUrl);
  const adsetJson = await adsetRes.json();
  console.log('=== ADSET INSIGHTS WITH ACTIONS ===');
  console.dir(adsetJson, { depth: null });

  // Query ad insights
  const adQuery = new URLSearchParams({
    access_token: token,
    fields: 'ad_id,ad_name,spend,inline_link_clicks,outbound_clicks,actions',
    time_range: JSON.stringify({ since: '2026-05-01', until: '2026-05-31' }),
  });
  const adUrl = `https://graph.facebook.com/v21.0/${campaignId}/insights?level=ad&${adQuery}`;
  const adRes = await fetch(adUrl);
  const adJson = await adRes.json();
  console.log('\n=== AD INSIGHTS WITH ACTIONS ===');
  console.dir(adJson, { depth: null });
}

main().catch(console.error);
