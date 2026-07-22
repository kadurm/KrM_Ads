const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const campaigns = await prisma.campanha.findMany({
    include: {
      cliente: true
    }
  });

  console.log('=== ALL CAMPAIGNS IN DB ===');
  campaigns.forEach(c => {
    console.log(`ID: ${c.id} | MetaID: ${c.meta_id} | Nome: ${c.nome_gerado} | Cliente: ${c.cliente?.nome}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
