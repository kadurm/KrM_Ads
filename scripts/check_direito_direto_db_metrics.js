const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const campaigns = await prisma.campanha.findMany({
    where: {
      cliente: {
        nome: 'Direito Direto'
      }
    },
    include: {
      metricas: {
        where: {
          data: {
            gte: new Date('2026-05-01T00:00:00.000Z'),
            lte: new Date('2026-05-31T23:59:59.999Z')
          }
        }
      }
    }
  });

  console.log('=== DATABASE METRICS FOR DIREITO DIRETO (MAY 2026) ===');
  campaigns.forEach(c => {
    console.log(`\nCampanha: ${c.nome_gerado} (ID: ${c.id}, MetaID: ${c.meta_id})`);
    let totalSpend = 0;
    let totalClicks = 0;
    let totalVisits = 0;
    c.metricas.forEach(m => {
      totalSpend += Number(m.valor_investido || 0);
      totalClicks += m.cliques || 0;
      totalVisits += m.visitas_perfil || 0;
    });
    console.log(`- Metricas count: ${c.metricas.length}`);
    console.log(`- Total Spend (DB): ${totalSpend.toFixed(2)}`);
    console.log(`- Total Clicks (DB): ${totalClicks}`);
    console.log(`- Total Profile Visits (DB): ${totalVisits}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
