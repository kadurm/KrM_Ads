const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- DEDUPLICANDO METRICAS DE CRIATIVOS ---');

  if (process.env.DIRECT_URL) {
    process.env.DATABASE_URL = process.env.DIRECT_URL;
  }

  // 1. Busca todos os registros de métricas de criativos
  const allMetrics = await prisma.metricaCriativo.findMany({
    orderBy: { data: 'desc' }
  });

  const uniqueMap = new Map();
  const toDelete = [];
  const toUpdate = [];

  for (const m of allMetrics) {
    // Normaliza a data para YYYY-MM-DD
    const dateStr = m.data.toISOString().split('T')[0];
    const key = `${m.criativo_id}_${dateStr}`;

    if (uniqueMap.has(key)) {
      // Se já vimos esse criativo nesse dia, marca para deletar a duplicata
      toDelete.push(m.id);
    } else {
      uniqueMap.set(key, m.id);
      
      // Armazena para atualizar após a deleção (evita conflitos de restrição unique)
      const targetDate = new Date(dateStr + 'T00:00:00.000Z');
      if (m.data.getTime() !== targetDate.getTime()) {
        toUpdate.push({ id: m.id, targetDate });
      }
    }
  }

  console.log(`Encontrados ${toDelete.length} registros duplicados de criativos para remover.`);

  // 2. Deleta as duplicatas primeiro
  if (toDelete.length > 0) {
    const deleted = await prisma.metricaCriativo.deleteMany({
      where: { id: { in: toDelete } }
    });
    console.log(`✅ Removidos ${deleted.count} registros duplicados de criativos.`);
  }

  // 3. Atualiza as datas dos registros restantes para 00:00:00.000Z
  console.log(`Atualizando ${toUpdate.length} datas de criativos para o padrão de meia-noite UTC...`);
  let updatedCount = 0;
  for (const item of toUpdate) {
    try {
      await prisma.metricaCriativo.update({
        where: { id: item.id },
        data: { data: item.targetDate }
      });
      updatedCount++;
    } catch (e) {
      console.error(`⚠️ Falha ao normalizar data para o registro ${item.id}:`, e.message);
    }
  }
  console.log(`✅ Normalizadas ${updatedCount} datas de criativos com sucesso.`);

  console.log('--- LIMPEZA E DEDUPLICACÃO DE CRIATIVOS CONCLUÍDA ---');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
