const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const clienteName = 'Solution Place';
  
  const dbCliente = await prisma.cliente.findFirst({
    where: { nome: { equals: clienteName, mode: 'insensitive' } }
  });

  const metrics = await prisma.metricaCampanha.findMany({
    where: {
      campanha: { cliente_id: dbCliente.id },
      data: {
        gte: new Date('2026-04-01T00:00:00Z'),
        lte: new Date('2026-04-30T23:59:59Z')
      }
    },
    include: {
      campanha: true
    }
  });

  console.log(`Total metrics records found in DB for April: ${metrics.length}`);
  
  // Group by campaign and day (YYYY-MM-DD)
  const groups = {};
  metrics.forEach(m => {
    const dayStr = m.data.toISOString().split('T')[0];
    const key = `${m.campanha.nome_gerado}_${dayStr}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  });

  let duplicateCount = 0;
  console.log('\n--- Duplicate analysis ---');
  Object.entries(groups).forEach(([key, list]) => {
    if (list.length > 1) {
      duplicateCount++;
      console.log(`Duplicate found for: ${key}`);
      list.forEach(item => {
        console.log(`  - ID: ${item.id}, Date: ${item.data.toISOString()}, Spend: ${item.valor_investido}`);
      });
    }
  });

  console.log(`\nTotal duplicate days: ${duplicateCount}`);
  await prisma.$disconnect();
}

main();
