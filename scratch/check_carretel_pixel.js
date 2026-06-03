const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const clienteName = 'Carretel Aviamentos';
  const c = await prisma.cliente.findFirst({
    where: { nome: { equals: clienteName, mode: 'insensitive' } }
  });

  if (!c) {
    console.error('Cliente não encontrado.');
    process.exit(1);
  }

  console.log(`=== CONFIGURAÇÃO DO CLIENTE: ${c.nome} ===`);
  console.log(`ID no DB: ${c.id}`);
  console.log(`Meta Account ID: ${c.meta_ads_account_id}`);
  console.log(`Meta Pixel ID: ${c.meta_pixel_id || 'NÃO CONFIGURADO'}`);
  console.log(`Meta Access Token: ${c.meta_access_token ? 'CONFIGURADO' : 'NÃO CONFIGURADO'}`);

  await prisma.$disconnect();
}

main();
