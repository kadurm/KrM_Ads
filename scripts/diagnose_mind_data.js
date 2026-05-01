const ACCESS_TOKEN = "EAAYYES5B9UgBRZAQO71F2EXGKwOkJk8KF1ZBpZBxeW4JMZBSFmo7T11dYZBbBWtD22cDnc1PA6Uc4kMR0HEUzs89wmj2J31rvU5932VMwaM3uRhZBZCfoxwDWaqQuxek4rz8lMQfCDMwokCx7lTzrTXZAzHcBVFc4DZAbY9mbLlavqeh1y4jrZBdjB7eGJJer847iNjMhz9Jno9onxjQQNzYRGsrX9O6evaZBwC0Sv4pum7WMwNMOoVEQZDZD";
const AD_ACCOUNT_ID = 'act_2373100163138748';

async function deepDiagnose() {
  console.log(`--- DIAGNÓSTICO PROFUNDO: Mind Gestão Empresarial ---`);
  
  // 1. Verificar campanhas em status comuns
  const url = `https://graph.facebook.com/v21.0/${AD_ACCOUNT_ID}/campaigns?access_token=${ACCESS_TOKEN}&fields=id,name,status&effective_status=["ACTIVE","PAUSED","ARCHIVED"]&limit=50`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.error) {
      console.error('❌ ERRO NA API:', data.error.message);
      
      console.log('--- Buscando contas vinculadas ao token para validar permissões ---');
      const accountsUrl = `https://graph.facebook.com/v21.0/me/adaccounts?access_token=${ACCESS_TOKEN}&fields=name,account_id`;
      const accRes = await fetch(accountsUrl);
      const accData = await accRes.json();
      console.log('Contas que este token PODE ver:', JSON.stringify(accData.data, null, 2));
      return;
    }

    if (!data.data || data.data.length === 0) {
      console.log('⚠️ Nenhuma campanha encontrada no ID act_2373100163138748.');
      
      const accountsUrl = `https://graph.facebook.com/v21.0/me/adaccounts?access_token=${ACCESS_TOKEN}&fields=name,account_id`;
      const accRes = await fetch(accountsUrl);
      const accData = await accRes.json();
      console.log('Contas acessíveis pelo token:', JSON.stringify(accData.data, null, 2));
    } else {
      console.log(`✅ Sucesso! Encontradas ${data.data.length} campanhas.`);
      data.data.forEach(c => console.log(` - [${c.status}] ${c.name} (${c.id})`));
    }
  } catch (e) {
    console.error('❌ ERRO CRÍTICO:', e.message);
  }
}

deepDiagnose();
