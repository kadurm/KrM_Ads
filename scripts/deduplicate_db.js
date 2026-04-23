const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- DEDUPLICANDO BANCO DE DADOS ---');

  // 1. Busca todos os registros de hoje (ou qualquer data com timestamp quebrado)
  const allMetrics = await prisma.metricaCampanha.findMany({
    orderBy: { data: 'desc' }
  });

  const uniqueMap = new Map();
  const toDelete = [];

  for (const m of allMetrics) {
    // Normaliza a data para YYYY-MM-DD
    const dateStr = m.data.toISOString().split('T')[0];
    const key = `${m.campanha_id}_${dateStr}`;

    if (uniqueMap.has(key)) {
      // Se já vimos essa campanha nesse dia, marca para deletar a duplicata
      toDelete.push(m.id);
    } else {
      uniqueMap.set(key, m.id);
      // Opcional: Atualiza o registro que vai ficar para ter a data exata 00:00:00
      await prisma.metricaCampanha.update({
        where: { id: m.id },
        data: { data: new Date(dateStr + 'T00:00:00.000Z') }
      });
    }
  }

  console.log(`Encontrados ${toDelete.length} registros duplicados para remover.`);

  if (toDelete.length > 0) {
    const deleted = await prisma.metricaCampanha.deleteMany({
      where: { id: { in: toDelete } }
    });
    console.log(`Removidos ${deleted.count} registros.`);
  }

  console.log('--- LIMPEZA CONCLUÍDA ---');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
