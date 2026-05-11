const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Configurações do reparo
const CLIENTE_ALVO = process.argv[2]; // Nome ou Slug do cliente
const DIAS_PARA_TRAS = parseInt(process.argv[3]) || 60; // Padrão 60 dias

async function main() {
  if (!CLIENTE_ALVO) {
    console.error('❌ Erro: Especifique o nome ou slug do cliente.');
    console.log('Uso: node scripts/fix_historical_data.js "Nome do Cliente" [dias]');
    process.exit(1);
  }

  console.log(`\n--- INICIANDO REPARO HISTÓRICO: ${CLIENTE_ALVO} ---`);

  // 1. Localizar Cliente
  const slug = CLIENTE_ALVO.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '');
  const cliente = await prisma.cliente.findFirst({
    where: {
      OR: [
        { nome: { equals: CLIENTE_ALVO, mode: 'insensitive' } },
        { slug: { equals: slug, mode: 'insensitive' } }
      ]
    }
  });

  if (!cliente) {
    console.error(`❌ Erro: Cliente '${CLIENTE_ALVO}' não encontrado no banco.`);
    process.exit(1);
  }

  console.log(`✅ Cliente encontrado: ${cliente.nome} (ID: ${cliente.id})`);

  // 2. Limpar Métricas Antigas (Onde mora a inconsistência)
  console.log('🧹 Limpando métricas antigas (Campanhas e Criativos)...');
  
  const delCamps = await prisma.metricaCampanha.deleteMany({
    where: { campanha: { cliente_id: cliente.id } }
  });
  
  const delAds = await prisma.metricaCriativo.deleteMany({
    where: { criativo: { campanha: { cliente_id: cliente.id } } }
  });

  console.log(`🗑️ Removidos: ${delCamps.count} registros de campanha, ${delAds.count} registros de criativos.`);

  // 3. Disparar Ressincronização Total
  const until = new Date().toISOString().split('T')[0];
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - DIAS_PARA_TRAS);
  const since = sinceDate.toISOString().split('T')[0];

  console.log(`📡 Disparando sincronização total (${since} até ${until})...`);

  // Como o script roda localmente, tentamos bater na API local (se estiver rodando) 
  // ou podemos simplesmente exportar a lógica, mas o mais seguro é via HTTP para garantir o contexto do Next.js
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  
  try {
    const response = await fetch(`${apiUrl}/api/meta/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente: cliente.nome,
        since,
        until,
        forceFullSync: true
      })
    });

    const result = await response.json();

    if (result.success) {
      console.log('✨ Sincronização concluída com sucesso!');
    } else {
      console.error('❌ Erro na sincronização:', result.error);
    }
  } catch (err) {
    console.error('❌ Falha ao conectar com a API:', err.message);
    console.log('Dica: Certifique-se de que o servidor (npm run dev) está rodando.');
  }

  console.log('--- REPARO FINALIZADO ---\n');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
