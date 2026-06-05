const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const since = new Date('2026-05-06T00:00:00Z');
  const until = new Date('2026-06-05T23:59:59Z');

  const metaId = '120236136455210488';
  const camp = await prisma.campanha.findUnique({
    where: { meta_id: metaId },
    include: {
      metricas: {
        where: {
          data: {
            gte: since,
            lte: until
          }
        },
        orderBy: { data: 'asc' }
      }
    }
  });

  if (!camp) {
    console.error('Campanha não encontrada');
    return;
  }

  console.log(`Campanha: ${camp.nome_gerado}`);
  console.log(`Filtro since: ${since.toISOString()} | until: ${until.toISOString()}`);
  console.log(`Total de métricas retornadas: ${camp.metricas.length}`);
  
  camp.metricas.slice(0, 10).forEach(m => {
    console.log(`- ID: ${m.id} | Data (Date Object): ${m.data} | Data (ISO): ${m.data.toISOString()} | Spend: R$ ${Number(m.valor_investido).toFixed(2)}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
