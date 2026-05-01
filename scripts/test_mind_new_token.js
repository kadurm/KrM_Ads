const ACCESS_TOKEN = "EAAYYES5B9UgBRZAQO71F2EXGKwOkJk8KF1ZBpZBxeW4JMZBSFmo7T11dYZBbBWtD22cDnc1PA6Uc4kMR0HEUzs89wmj2J31rvU5932VMwaM3uRhZBZCfoxwDWaqQuxek4rz8lMQfCDMwokCx7lTzrTXZAzHcBVFc4DZAbY9mbLlavqeh1y4jrZBdjB7eGJJer847iNjMhz9Jno9onxjQQNzYRGsrX9O6evaZBwC0Sv4pum7WMwNMOoVEQZDZD";
const AD_ACCOUNT_ID = 'act_2373100163138748';

async function testSync() {
  console.log(`Testando sincronização com NOVO TOKEN para: Mind`);
  console.log(`Account ID: ${AD_ACCOUNT_ID}`);
  
  const url = `https://graph.facebook.com/v21.0/${AD_ACCOUNT_ID}/campaigns?access_token=${ACCESS_TOKEN}&fields=id,name,status&limit=5`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.error) {
      console.error('❌ Erro da Meta API:', JSON.stringify(data.error, null, 2));
    } else {
      console.log('✅ CONEXÃO ESTABELECIDA COM O NOVO TOKEN!');
      console.log('Campanhas encontradas:', data.data?.length || 0);
      if (data.data) {
        data.data.forEach(c => console.log(` - [${c.status}] ${c.name}`));
      }
    }
  } catch (e) {
    console.error('❌ Erro na requisição:', e.message);
  }
}

testSync();
