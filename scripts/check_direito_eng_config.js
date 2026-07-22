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
  const campaignId = '120252358624940746'; // Direito Direto Engagement Campaign
  
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
}

main().catch(console.error);
