const fs = require('fs');
const path = require('path');

// Carregar .env
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
  const accountId = 'act_487189220271716'; // Carretel Aviamentos Account ID
  
  const since = '2026-05-01';
  const until = '2026-05-31';

  const query = new URLSearchParams({
    access_token: token,
    fields: 'campaign_id,campaign_name,spend,impressions,reach,inline_link_click_ctr,clicks,inline_link_clicks,actions,action_values',
    level: 'campaign',
    time_range: JSON.stringify({ since, until }),
    limit: '100'
  });

  const url = `https://graph.facebook.com/v21.0/${accountId}/insights?${query}`;
  console.log(`📡 Requisitando API Graph da Meta de ${since} a ${until}...`);
  console.log(`URL: https://graph.facebook.com/v21.0/${accountId}/insights?...`);

  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json();
    console.error('Erro na Meta API:', JSON.stringify(err, null, 2));
    return;
  }

  const json = await res.json();
  console.log('\n================================================================');
  console.log('RESPOSTA BRUTA DO META ADS (MAIO/2026):');
  console.log('================================================================');
  console.log(JSON.stringify(json, null, 2));
}

main().catch(console.error);
