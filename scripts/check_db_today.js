const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0); // Ajuste conforme a lógica do sync

  console.log('Consultando Métricas no Banco para HOJE (ou data próxima):');
  
  const metrics = await prisma.metricaCampanha.findMany({
    where: {
      data: {
        gte: new Date('2026-04-23T00:00:00'),
        lte: new Date('2026-04-23T23:59:59'),
      }
    },
    include: {
      campanha: true
    }
  });

  console.dir(metrics, { depth: null });

  const totalInv = metrics.reduce((acc, m) => acc + Number(m.valor_investido), 0);
  const totalLeads = metrics.reduce((acc, m) => acc + m.conversas_leads, 0);

  console.log('\n--- TOTAIS NO BANCO ---');
  console.log('Total Investimento:', totalInv);
  console.log('Total Leads:', totalLeads);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
