const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const clientes = await prisma.cliente.findMany();
  
  for (const c of clientes) {
    const nome = c.nome;
    const slug = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '');
    const shortName = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, "").split(' ')[0].replace(/[^a-zA-Z0-9]/g, '');
    
    console.log(`\nCliente: ${nome}`);
    console.log(`Variáveis de Account ID testadas na ordem:`);
    console.log(`1. META_AD_ACCOUNT_ID_${slug.toUpperCase()}`);
    console.log(`2. META_AD_ACCOUNT_ID_${slug}`);
    console.log(`3. META_AD_ACCOUNT_ID_${shortName.toUpperCase()}`);
    console.log(`4. META_AD_ACCOUNT_ID_${shortName}`);
    
    console.log(`Variáveis de Token testadas na ordem:`);
    console.log(`1. META_ACCESS_TOKEN_${slug.toUpperCase()}`);
    console.log(`2. META_ACCESS_TOKEN_${slug}`);
    console.log(`3. META_ACCESS_TOKEN_${shortName.toUpperCase()}`);
    console.log(`4. META_ACCESS_TOKEN_${shortName}`);
  }
  await prisma.$disconnect();
}

main().catch(console.error);
