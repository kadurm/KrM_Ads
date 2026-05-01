const ACCESS_TOKEN = "EAAYYES5B9UgBRYg5rbhu4jVQt8S4w4Of8Gc1PDjcR1DG2dRMEjPb5LmeQy2Gho6tZBdZACuD1cSUaf1ldyBoRZAEZCwY3RkX7ad3t1XGliC71R2WvzQdm1frZAhx5ANOzUXSSB1BWywyZBOUKLej2rbPvYv3j6TDMeL8qQ2HeVKHUWt6I55lnOKIIdg6DfpQZC9BzSExrg7B1cY1f4ZAGp4ND1w6kbpDF3kVW1sCHHyKjBp3YGkd2RQ4nWS3oXyEt5izvLwSjwWjCNXEAmkCi84VWOPymZAb0Vmn6T3YZD";
const AD_ACCOUNT_ID = 'act_2373100163138748';

async function testSync() {
  console.log(`Testando sincronização para: Mind`);
  console.log(`Account ID: ${AD_ACCOUNT_ID}`);
  
  const url = `https://graph.facebook.com/v21.0/${AD_ACCOUNT_ID}/campaigns?access_token=${ACCESS_TOKEN}&fields=id,name,status&limit=5`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.error) {
      console.error('❌ Erro da Meta API:', JSON.stringify(data.error, null, 2));
    } else {
      console.log('✅ Conexão com a Meta API estabelecida com sucesso!');
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
