const ACCESS_TOKEN = "EAAYYES5B9UgBRQaRlKc2t7qZB27kqokZBP1EKmFI6Hub7ZBNdZBGN3JoSP6dpZBQ0mufMKo71VZBgh93OdP0lalt1xZCXO8HHNc5avK3p0KhqzXgLv5cNLcXmVZBOZA72etylag2GJRYxZBxe9Sk96YYCGKi1I0wX1NDaEedl70vzyqdSO29B58bxX6rwsEnutt0PcnOa4QSnBYKaB";
const AD_ACCOUNT_ID = 'act_861875509414758';

async function testSync() {
  console.log(`Testando sincronização para: Solution Place`);
  
  const url = `https://graph.facebook.com/v21.0/${AD_ACCOUNT_ID}/campaigns?access_token=${ACCESS_TOKEN}&fields=id,name,status&limit=5`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.error) {
      console.error('❌ Erro da Meta API:', JSON.stringify(data.error, null, 2));
    } else {
      console.log('✅ Conexão com a Meta API estabelecida com sucesso!');
    }
  } catch (e) {
    console.error('❌ Erro na requisição:', e.message);
  }
}

testSync();
