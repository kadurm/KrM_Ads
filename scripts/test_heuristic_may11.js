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

function getMetric(actions, type, isValue = false) {
  if (!Array.isArray(actions)) return 0;
  const matches = actions.filter(a => a.action_type === type);
  if (matches.length === 0) return 0;
  return matches.reduce((acc, a) => acc + (isValue ? parseFloat(a.value || 0) : parseInt(a.value || 0, 10)), 0);
}

async function main() {
  const token = process.env.META_ACCESS_TOKEN_GLOBAL;
  const campaignId = '120249480706290746'; // Direito Direto Traffic Campaign
  
  const query = new URLSearchParams({
    access_token: token,
    fields: 'campaign_id,campaign_name,spend,impressions,reach,inline_link_clicks,outbound_clicks,actions',
    time_range: JSON.stringify({ since: '2026-05-11', until: '2026-05-11' }),
  });

  const url = `https://graph.facebook.com/v21.0/${campaignId}/insights?${query}`;
  const res = await fetch(url);
  const json = await res.json();

  const item = json.data[0];
  const linkClicks = parseInt(item.inline_link_clicks) || 0;
  const outboundClicks = Array.isArray(item.outbound_clicks) ? item.outbound_clicks.reduce((acc, c) => acc + (parseInt(c.value) || 0), 0) : 0;
  const nativeVisits = getMetric(item.actions, 'onsite_conversion.instagram_profile_visit');
  
  console.log('--- VARIABLES ---');
  console.log('linkClicks:', linkClicks);
  console.log('outboundClicks:', outboundClicks);
  console.log('nativeVisits:', nativeVisits);

  let totalVisitas = 0;
  if (nativeVisits > 0) {
    totalVisitas = linkClicks + nativeVisits;
    console.log('Selected branch: nativeVisits > 0');
  } else if (outboundClicks > (linkClicks * 0.5)) {
    totalVisitas = Math.abs(linkClicks - outboundClicks);
    console.log('Selected branch: outboundClicks > linkClicks * 0.5');
  } else {
    totalVisitas = linkClicks;
    console.log('Selected branch: fallback (linkClicks)');
  }
  
  console.log('Calculated totalVisitas:', totalVisitas);
}

main().catch(console.error);
