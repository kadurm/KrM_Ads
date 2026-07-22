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
  const rawAccountId = '1621561332322856'; // Direito Direto
  const AD_ACCOUNT_ID = `act_${rawAccountId}`;

  const url = `https://graph.facebook.com/v21.0/${AD_ACCOUNT_ID}/adsets?access_token=${token}&fields=campaign_id,destination_type,optimization_goal&limit=1000`;
  console.log(`Fetching adsets from: ${url.replace(token, 'TOKEN_HIDDEN')}`);
  
  const res = await fetch(url);
  console.log(`Response Status: ${res.status} ${res.statusText}`);
  const data = await res.json();
  console.dir(data, { depth: null });
}

main().catch(console.error);
