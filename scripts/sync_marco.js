
async function syncAndCheck() {
  const cliente = 'Solution Place';
  const since = '2026-03-01';
  const until = '2026-03-31';

  console.log(`🚀 Iniciando Sincronização de ${cliente} para o período: ${since} até ${until}...`);

  // Chama o endpoint de sync (POST)
  const syncRes = await fetch('http://localhost:3000/api/meta/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cliente, since, until })
  });

  const syncData = await syncRes.json();
  if (!syncData.success) {
    console.error('❌ Falha no Sync:', syncData.error);
    return;
  }

  console.log(`✅ Sync concluído em ${syncData.duration}. Verificando dados no banco...`);

  // Consulta o banco para ver o resultado da campanha [05] no período
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  const camp05 = await prisma.campanha.findFirst({
    where: { 
      cliente: { nome: cliente },
      nome_gerado: { contains: '[05]' }
    },
    include: {
      metricas: {
        where: {
          data: {
            gte: new Date(since + 'T00:00:00.000Z'),
            lte: new Date(until + 'T23:59:59.999Z')
          }
        }
      }
    }
  });

  if (camp05) {
    const totalVisitas = camp05.metricas.reduce((acc, m) => acc + m.visitas_perfil, 0);
    console.log(`\n📊 RESULTADO PARA CAMPANHA [05]:`);
    console.log(`Nome: ${camp05.nome_gerado}`);
    console.log(`Total de Visitas no Banco: ${totalVisitas}`);
    
    if (totalVisitas === 312) {
      console.log('✨ SUCESSO! O valor agora é 312 conforme esperado.');
    } else {
      console.log(`⚠️ O valor ainda é ${totalVisitas}. Verifique se a métrica correta está disponível na Meta.`);
    }
  } else {
    console.log('❌ Campanha [05] não encontrada após o sync.');
  }
}

syncAndCheck();
