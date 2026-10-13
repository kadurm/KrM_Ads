const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testPrisma() {
  try {
    const clients = await prisma.cliente.findMany({
      select: { nome: true, slug: true, meta_ads_account_id: true }
    });
    console.log('✅ Prisma Client conectado perfeitamente ao Neon PostgreSQL!');
    console.log(`Encontrados ${clients.length} clientes:`);
    clients.forEach(c => console.log(` • ${c.nome} [${c.slug}] (${c.meta_ads_account_id})`));

    const totalMetricas = await prisma.metricaCampanha.count();
    console.log(`\n📊 Total de métricas de campanha no banco: ${totalMetricas}`);
  } catch (err) {
    console.error('❌ Erro no Prisma:', err);
  } finally {
    await prisma.$disconnect();
  }
}

testPrisma();
