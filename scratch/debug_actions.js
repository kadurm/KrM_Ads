const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
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

async function main() {
  const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN_GLOBAL;
  const CAMP_ID = '52545041016220'; // ID da campanha do print ([03][KrM][Message][Curso 20/21 - Maio])

  const since = '2026-04-18';
  const until = '2026-05-18';
  const tr = JSON.stringify({ since, until });

  const url = `https://graph.facebook.com/v21.0/${CAMP_ID}/insights?fields=spend,actions,action_values&time_range=${encodeURIComponent(tr)}&access_token=${ACCESS_TOKEN}`;
  
  const res = await fetch(url);
  const json = await res.json();
  
  console.log('--- INSIGHTS DA CAMPANHA ---');
  if (json.data && json.data.length > 0) {
      console.log(`Spend: ${json.data[0].spend}`);
      console.log('Actions:');
      (json.data[0].actions || []).forEach(a => {
          console.log(`  - ${a.action_type}: ${a.value}`);
      });
  } else {
      console.log('Sem dados.');
  }
}
main();
