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
  const accountId = 'act_487189220271716'; // Carretel Aviamentos
  
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
  const res = await fetch(url);
  const json = await res.json();

  const trafficCamp = json.data?.find(c => c.campaign_name.includes('Traffic'));
  
  console.log('================================================================');
  console.log('CAMPANHA DE TRÁFEGO BRUTA (MAIO/2026):');
  console.log('================================================================');
  if (!trafficCamp) {
    console.log('Campanha de Tráfego não encontrada no JSON.');
    console.dir(json, { depth: null });
  } else {
    console.dir(trafficCamp, { depth: null, maxArrayLength: null });
  }
}

main().catch(console.error);
