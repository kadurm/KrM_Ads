const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const metaId = '120245039643090488';
  
  const metricas = await prisma.metricaCampanha.findMany({
    where: {
      campanha: { meta_id: metaId }
    },
    orderBy: { data: 'asc' }
  });

  console.log(`=== Linhas de Métrica para a Campanha ${metaId} ===`);
  console.log(`Total de registros: ${metricas.length}`);

  metricas.forEach(m => {
    console.log(`ID: ${m.id} | Data (ISO): ${m.data.toISOString()} | Investido: R$ ${Number(m.valor_investido).toFixed(2)} | Impressões: ${m.impressoes}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
