const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testSync() {
  const clienteNome = "Solution Place";
  const since = "2026-03-24";
  const until = "2026-04-23";

  console.log(`\n🚀 INICIANDO TESTE DE SINCRONIZAÇÃO OTIMIZADA`);
  console.log(`Cliente: ${clienteNome} | Período: ${since} até ${until}`);

  // Como estamos testando o código da API, mas rodando como script, 
  // vamos simular a chamada ao endpoint POST.
  // IMPORTANTE: Certifique-se de que as variáveis de ambiente estão carregadas.
  
  try {
    // 1. Verificar se o cliente existe
    const cliente = await prisma.cliente.findFirst({ where: { nome: clienteNome } });
    if (!cliente) {
      console.log(`❌ Cliente ${clienteNome} não encontrado no banco.`);
      return;
    }

    console.log(`✅ Cliente encontrado: ${cliente.id}`);

    // 2. Tentar disparar a API local (assumindo que o server está rodando na porta 3000)
    const res = await fetch('http://localhost:3000/api/meta/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ since, until, cliente: clienteNome })
    });

    const data = await res.json();
    console.log(`\n📊 RESULTADO DA API:`);
    console.dir(data, { depth: null });

    if (data.success) {
      console.log(`\n✅ Sincronização concluída com sucesso em ${data.duration}!`);
      
      // 3. Validar gravação no banco
      const metricas = await prisma.metricaCampanha.count({
        where: { campanha: { cliente_id: cliente.id }, data: { gte: new Date(since), lte: new Date(until) } }
      });
      console.log(`📌 Métricas de Campanha no Banco: ${metricas}`);

      const metricasCriativo = await prisma.metricaCriativo.count({
        where: { criativo: { campanha: { cliente_id: cliente.id } }, data: { gte: new Date(since), lte: new Date(until) } }
      });
      console.log(`📌 Métricas de Criativos no Banco: ${metricasCriativo}`);
    } else {
      console.log(`❌ Falha na sincronização: ${data.error}`);
    }

  } catch (err) {
    console.error(`\n💥 Erro Fatal no Teste:`, err.message);
  } finally {
    await prisma.$disconnect();
  }
}

testSync();
