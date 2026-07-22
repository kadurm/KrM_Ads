const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const campaignId = '215c55f3-a721-47c6-af61-70af96afddeb'; // Direito Direto Traffic
  
  // Find all metrics for this campaign in May
  const metrics = await prisma.metricaCampanha.findMany({
    where: {
      campanha_id: campaignId,
      data: {
        gte: new Date('2026-05-10T00:00:00.000Z'),
        lte: new Date('2026-05-12T23:59:59.999Z')
      }
    }
  });

  console.log('=== METRICS FOR MAY 10 - 12 ===');
  metrics.forEach(m => {
    console.log(`ID: ${m.id}`);
    console.log(`Data: ${m.data.toISOString()}`);
    console.log(`Cliques: ${m.cliques}`);
    console.log(`Visitas: ${m.visitas_perfil}`);
    console.log(`Valor Investido: ${m.valor_investido}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
