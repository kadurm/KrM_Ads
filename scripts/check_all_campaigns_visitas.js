const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const metrics = await prisma.metricaCampanha.findMany({
    where: {
      data: {
        gte: new Date('2026-05-01T00:00:00.000Z'),
        lte: new Date('2026-05-31T23:59:59.999Z')
      }
    },
    include: {
      campanha: {
        include: {
          cliente: true
        }
      }
    }
  });

  const summary = {};
  metrics.forEach(m => {
    const key = m.campanha.nome_gerado + ' | ' + m.campanha.cliente?.nome;
    if (!summary[key]) {
      summary[key] = { spend: 0, clicks: 0, profileVisits: 0, count: 0 };
    }
    summary[key].spend += Number(m.valor_investido || 0);
    summary[key].clicks += m.cliques || 0;
    summary[key].profileVisits += m.visitas_perfil || 0;
    summary[key].count++;
  });

  console.log('=== MAY 2026 CAMPAIGNS SUMMARY ===');
  Object.keys(summary).forEach(key => {
    const s = summary[key];
    console.log(`\n${key}:`);
    console.log(`- Count: ${s.count} days`);
    console.log(`- Spend: ${s.spend.toFixed(2)}`);
    console.log(`- Clicks: ${s.clicks}`);
    console.log(`- Profile Visits: ${s.profileVisits}`);
    console.log(`- Diff (Visits - Clicks): ${s.profileVisits - s.clicks}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
