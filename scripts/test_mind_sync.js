const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const dotenv = require('dotenv');
dotenv.config();

const clienteNome = 'Mind Gestão Empresarial';
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN_GLOBAL;
const AD_ACCOUNT_ID = 'act_2373100163138748';

async function testSync() {
  console.log(`Testando sincronização para: ${clienteNome}`);
  console.log(`Account ID: ${AD_ACCOUNT_ID}`);
  
  const url = `https://graph.facebook.com/v21.0/${AD_ACCOUNT_ID}/campaigns?access_token=${ACCESS_TOKEN}&fields=id,name,status&limit=5`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.error) {
      console.error('❌ Erro da Meta API:', JSON.stringify(data.error, null, 2));
    } else {
      console.log('✅ Conexão com a Meta API estabelecida com sucesso!');
      console.log('Campanhas encontradas:', data.data.length);
      data.data.forEach(c => console.log(` - [${c.status}] ${c.name}`));
    }
  } catch (e) {
    console.error('❌ Erro na requisição:', e.message);
  }
}

testSync().finally(() => process.exit());
