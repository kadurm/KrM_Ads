const ACCESS_TOKEN = "EAAYYES5B9UgBRZAQO71F2EXGKwOkJk8KF1ZBpZBxeW4JMZBSFmo7T11dYZBbBWtD22cDnc1PA6Uc4kMR0HEUzs89wmj2J31rvU5932VMwaM3uRhZBZCfoxwDWaqQuxek4rz8lMQfCDMwokCx7lTzrTXZAzHcBVFc4DZAbY9mbLlavqeh1y4jrZBdjB7eGJJer847iNjMhz9Jno9onxjQQNzYRGsrX9O6evaZBwC0Sv4pum7WMwNMOoVEQZDZD";
const AD_ACCOUNT_ID = 'act_635037056097163';

async function diagnoseYuri() {
  console.log(`--- DIAGNÓSTICO: Dr. Yuri Telles ---`);
  
  const url = `https://graph.facebook.com/v21.0/${AD_ACCOUNT_ID}/campaigns?access_token=${ACCESS_TOKEN}&fields=id,name,status&limit=5`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.error) {
      console.error('❌ ERRO DA API:', data.error.message);
      
      const accountsUrl = `https://graph.facebook.com/v21.0/me/adaccounts?access_token=${ACCESS_TOKEN}&fields=name,account_id`;
      const accRes = await fetch(accountsUrl);
      const accData = await accRes.json();
      console.log('Contas acessíveis:', JSON.stringify(accData.data, null, 2));
    } else {
      console.log(`✅ CONEXÃO OK! Campanhas encontradas: ${data.data?.length || 0}`);
    }
  } catch (e) {
    console.error('❌ ERRO:', e.message);
  }
}

diagnoseYuri();
