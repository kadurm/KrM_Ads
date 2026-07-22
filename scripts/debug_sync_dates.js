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

function graphUrl(path, query) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });
  return url.toString();
}

async function fetchMetaInsights(url) {
  let allData = [];
  let currentUrl = url;

  while (currentUrl) {
    const res = await fetch(currentUrl);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Meta API Error: ${err.error?.message || res.statusText}`);
    }
    const json = await res.json();
    if (json.data) allData = [...allData, ...json.data];
    currentUrl = json.paging?.next || null;
  }
  return allData;
}

async function main() {
  const token = process.env.META_ACCESS_TOKEN_GLOBAL;
  const accountId = 'act_1621561332322856'; // Direito Direto
  const since = '2026-04-26';
  const until = '2026-06-10';

  const query = {
    access_token: token,
    limit: '1000',
    time_range: JSON.stringify({ since, until }),
    fields: 'campaign_id,campaign_name,spend,impressions,reach,inline_link_clicks,outbound_clicks,actions,action_values',
    level: 'campaign',
    time_increment: '1'
  };

  const url = graphUrl(`${accountId}/insights`, query);
  const data = await fetchMetaInsights(url);

  console.log('Fetched', data.length, 'records for Direito Direto:');
  const sorted = data.sort((a, b) => a.date_start.localeCompare(b.date_start));
  sorted.forEach(item => {
    console.log(`${item.date_start} (${item.campaign_name}): spend=${item.spend}, clicks=${item.inline_link_clicks}`);
  });
}

main().catch(console.error);
