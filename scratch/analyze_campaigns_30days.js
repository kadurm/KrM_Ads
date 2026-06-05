const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const slug = 'solutionplace';
  const cliente = await prisma.cliente.findUnique({ where: { slug } });
  if (!cliente) {
    console.error('Cliente não encontrado.');
    return;
  }

  const startDate = new Date('2026-05-06T00:00:00.000Z');
  const endDate = new Date('2026-06-04T23:59:59.999Z');

  console.log(`=== Campanhas e Gastos de 06/05/2026 a 04/06/2026 ===`);
  
  const campanhas = await prisma.campanha.findMany({
    where: { cliente_id: cliente.id },
    include: {
      metricas: {
        where: {
          data: { gte: startDate, lte: endDate }
        }
      }
    }
  });

  let totalGeral = 0;

  campanhas.forEach(camp => {
    const spend = camp.metricas.reduce((sum, m) => sum + Number(m.valor_investido), 0);
    const impressions = camp.metricas.reduce((sum, m) => sum + m.impressoes, 0);
    const clicks = camp.metricas.reduce((sum, m) => sum + m.cliques, 0);
    const leads = camp.metricas.reduce((sum, m) => sum + m.conversas_leads, 0);

    if (spend > 0 || impressions > 0 || clicks > 0 || leads > 0) {
      console.log(`\nCampanha: ${camp.nome_gerado} (Meta ID: ${camp.meta_id})`);
      console.log(`  - Objetivo: ${camp.objetivo}`);
      console.log(`  - Investido: R$ ${spend.toFixed(2)}`);
      console.log(`  - Impressões: ${impressions} | Cliques: ${clicks} | Leads: ${leads}`);
      totalGeral += spend;
    }
  });

  console.log(`\n========================================`);
  console.log(`Total Geral Investido no Período: R$ ${totalGeral.toFixed(2)}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
