const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const campaignId = '215c55f3-a721-47c6-af61-70af96afddeb'; // Direito Direto [00][KrM][CBO][Traffic]
  const metrics = await prisma.metricaCampanha.findMany({
    where: {
      campanha_id: campaignId,
      data: {
        gte: new Date('2026-05-11T00:00:00.000Z'),
        lte: new Date('2026-06-10T23:59:59.999Z')
      }
    },
    orderBy: {
      data: 'asc'
    }
  });

  console.log(`=== DAILY METRICS (MAY 11 - JUN 10) ===`);
  let totalSpend = 0;
  let totalClicks = 0;
  let totalVisits = 0;
  metrics.forEach(m => {
    const dStr = m.data.toISOString().split('T')[0];
    totalSpend += Number(m.valor_investido || 0);
    totalClicks += m.cliques || 0;
    totalVisits += m.visitas_perfil || 0;
    console.log(`${dStr}: Cliques=${m.cliques}, Visitas=${m.visitas_perfil}, Spend=${Number(m.valor_investido).toFixed(2)}`);
  });
  console.log(`\nTotals: Spend=${totalSpend.toFixed(2)}, Clicks=${totalClicks}, Visitas=${totalVisits}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
