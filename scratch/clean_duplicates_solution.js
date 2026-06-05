const fs = require('fs');
const path = require('path');

// Carrega o .env manualmente
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) return;
      const key = trimmed.substring(0, eqIdx).trim();
      let val = trimmed.substring(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    });
    console.log('✅ Variáveis de ambiente do arquivo .env carregadas com sucesso.');
  }
} catch (e) {
  console.warn('⚠️ Não foi possível ler o arquivo .env:', e.message);
}

if (process.env.DIRECT_URL) {
  console.log('🔄 Redirecionando DATABASE_URL para DIRECT_URL (Conexão Direta)...');
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- INICIANDO DEDUPLICAÇÃO E NORMALIZAÇÃO DE DATAS ---');

  // --- 1. DEDUPLICAR METRICAS DE CAMPANHA ---
  const allCampMetrics = await prisma.metricaCampanha.findMany({
    orderBy: { data: 'desc' }
  });

  const campUniqueMap = new Map();
  const campToDelete = [];
  const campToUpdate = [];

  for (const m of allCampMetrics) {
    const dateStr = new Date(m.data).toISOString().split('T')[0];
    const key = `${m.campanha_id}_${dateStr}`;

    if (campUniqueMap.has(key)) {
      campToDelete.push(m.id);
    } else {
      campUniqueMap.set(key, m.id);
      const targetDate = new Date(dateStr + 'T00:00:00.000Z');
      if (new Date(m.data).getTime() !== targetDate.getTime()) {
        campToUpdate.push({ id: m.id, targetDate });
      }
    }
  }

  console.log(`Métricas de Campanha: ${campToDelete.length} duplicatas para remover, ${campToUpdate.length} para normalizar.`);

  if (campToDelete.length > 0) {
    const deleted = await prisma.metricaCampanha.deleteMany({
      where: { id: { in: campToDelete } }
    });
    console.log(`✅ Removidas ${deleted.count} duplicatas de campanha.`);
  }

  let campUpdatedCount = 0;
  for (const item of campToUpdate) {
    try {
      await prisma.metricaCampanha.update({
        where: { id: item.id },
        data: { data: item.targetDate }
      });
      campUpdatedCount++;
    } catch (e) {
      console.error(`⚠️ Falha ao normalizar data da campanha ${item.id}:`, e.message);
    }
  }
  console.log(`✅ Normalizadas ${campUpdatedCount} datas de métricas de campanha.`);

  // --- 2. DEDUPLICAR METRICAS DE CRIATIVO ---
  const allCriativoMetrics = await prisma.metricaCriativo.findMany({
    orderBy: { data: 'desc' }
  });

  const criativoUniqueMap = new Map();
  const criativoToDelete = [];
  const criativoToUpdate = [];

  for (const m of allCriativoMetrics) {
    const dateStr = new Date(m.data).toISOString().split('T')[0];
    const key = `${m.criativo_id}_${dateStr}`;

    if (criativoUniqueMap.has(key)) {
      criativoToDelete.push(m.id);
    } else {
      criativoUniqueMap.set(key, m.id);
      const targetDate = new Date(dateStr + 'T00:00:00.000Z');
      if (new Date(m.data).getTime() !== targetDate.getTime()) {
        criativoToUpdate.push({ id: m.id, targetDate });
      }
    }
  }

  console.log(`Métricas de Criativo: ${criativoToDelete.length} duplicatas para remover, ${criativoToUpdate.length} para normalizar.`);

  if (criativoToDelete.length > 0) {
    const deleted = await prisma.metricaCriativo.deleteMany({
      where: { id: { in: criativoToDelete } }
    });
    console.log(`✅ Removidas ${deleted.count} duplicatas de criativo.`);
  }

  let criativoUpdatedCount = 0;
  for (const item of criativoToUpdate) {
    try {
      await prisma.metricaCriativo.update({
        where: { id: item.id },
        data: { data: item.targetDate }
      });
      criativoUpdatedCount++;
    } catch (e) {
      console.error(`⚠️ Falha ao normalizar data do criativo ${item.id}:`, e.message);
    }
  }
  console.log(`✅ Normalizadas ${criativoUpdatedCount} datas de métricas de criativo.`);

  console.log('--- DEDUPLICAÇÃO E LIMPEZA CONCLUÍDAS COM SUCESSO ---');
}

main()
  .catch(err => console.error(err))
  .finally(async () => await prisma.$disconnect());
