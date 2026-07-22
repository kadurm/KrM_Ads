const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.cliente.findFirst({
    where: { nome: 'Carretel Aviamentos' }
  });
  if (!c) {
    console.log('Cliente não encontrado');
    return;
  }

  // Buscar todas as métricas de campanha de Carretel Aviamentos em Maio/2026
  const startPeriod = new Date('2026-05-01T00:00:00.000Z');
  const endPeriod = new Date('2026-05-31T23:59:59.000Z');

  const metricas = await prisma.metricaCampanha.findMany({
    where: {
      campanha: { cliente_id: c.id },
      data: {
        gte: startPeriod,
        lte: endPeriod
      }
    },
    include: {
      campanha: true
    },
    orderBy: { data: 'asc' }
  });

  console.log(`Total de registros de métricas no banco para Maio: ${metricas.length}`);

  // Agrupar por Campanha e Data (YYYY-MM-DD)
  const groups = {};
  for (const m of metricas) {
    const dateStr = m.data.toISOString().split('T')[0];
    const key = `${m.campanha.nome_gerado}_${dateStr}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push({
      id: m.id,
      dataOriginal: m.data.toISOString(),
      investido: m.valor_investido,
      impressoes: m.impressoes
    });
  }

  let duplicatesFound = 0;
  console.log('\nAnálise de duplicados por data civil:');
  Object.entries(groups).forEach(([key, items]) => {
    if (items.length > 1) {
      duplicatesFound++;
      console.log(`\n⚠️ DUPLICADO: ${key} (${items.length} registros no banco)`);
      items.forEach(item => {
        console.log(`  - ID: ${item.id} | Data no Banco: ${item.dataOriginal} | Investido: R$ ${item.investido} | Impressões: ${item.impressoes}`);
      });
    }
  });

  if (duplicatesFound === 0) {
    console.log('✅ Nenhum registro duplicado encontrado para a mesma data civil em Maio.');
  } else {
    console.log(`\nFato: Encontrados ${duplicatesFound} grupos duplicados.`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
