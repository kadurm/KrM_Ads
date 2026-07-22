const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.cliente.findFirst({
    where: { nome: { contains: 'Direito Direto', mode: 'insensitive' } }
  });
  if (!c) return;

  const metricas = await prisma.metricaCampanha.findMany({
    where: {
      campanha: { cliente_id: c.id },
      data: {
        gte: new Date('2026-05-01T00:00:00.000Z'),
        lte: new Date('2026-05-31T23:59:59.000Z')
      }
    },
    orderBy: { data: 'asc' }
  });

  console.log('Daily Metrics for May 2026:');
  metricas.forEach(m => {
    console.log(`${m.data.toISOString().split('T')[0]}: Cliques=${m.cliques}, Visitas=${m.visitas_perfil}, Investido=${m.valor_investido}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
