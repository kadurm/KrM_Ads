const fs = require('fs');
const path = require('path');
const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
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

const APP_ID = '1715311929849160';
const APP_SECRET = 'd28eaa13a2f84741d3cf4f885911b4ef';
const SHORT_TOKEN = process.env.META_ACCESS_TOKEN_GLOBAL;

async function main() {
  console.log('=== TROCANDO TOKEN CURTO POR TOKEN DE LONGA DURAÇÃO ===');
  console.log('App ID:', APP_ID);
  console.log('Token curto (primeiros 30 chars):', SHORT_TOKEN?.substring(0, 30));

  const url = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${encodeURIComponent(SHORT_TOKEN)}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.error) {
    console.log('\n❌ ERRO na troca:', data.error.message);
    console.log('\n>> O token curto já expirou. Você precisa:');
    console.log('>> 1. Gerar um NOVO token no Graph API Explorer');
    console.log('>> 2. Colar aqui IMEDIATAMENTE (ele dura só ~2h)');
    console.log('>> 3. Eu troco por um de longa duração automaticamente');
  } else {
    console.log('\n✅ TOKEN DE LONGA DURAÇÃO OBTIDO!');
    console.log('Token:', data.access_token);
    console.log('Tipo:', data.token_type);
    console.log('Expira em:', data.expires_in ? `${Math.round(data.expires_in / 86400)} dias` : 'Nunca (perpétuo)');

    // Testar se funciona
    console.log('\n=== TESTANDO TOKEN LONGO ===');
    const testRes = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${data.access_token}`);
    const testData = await testRes.json();
    console.log('Teste:', testData.error ? `❌ ${testData.error.message}` : `✅ Usuário: ${testData.name || testData.id}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
