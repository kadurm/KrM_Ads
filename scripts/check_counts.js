const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const clienteNome = 'Solution Place';
  try {
    const c = await prisma.cliente.findFirst({ where: { nome: clienteNome } });
    if (!c) {
      console.log(`Cliente ${clienteNome} não encontrado.`);
      return;
    }

    const mc = await prisma.metricaCampanha.count({
      where: { campanha: { cliente_id: c.id } }
    });

    const mcr = await prisma.metricaCriativo.count({
      where: { criativo: { campanha: { cliente_id: c.id } } }
    });

    console.log(`\n📊 STATUS DO BANCO DE DADOS - ${clienteNome}`);
    console.log('------------------------------------------');
    console.log(`ID do Cliente: ${c.id}`);
    console.log(`Métricas de Campanha: ${mc}`);
    console.log(`Métricas de Criativos: ${mcr}`);
    console.log('------------------------------------------');

    if (mc === 0) {
      console.log('⚠️ ALERTA: Nenhuma métrica de campanha encontrada.');
    } else {
      console.log('✅ Dados encontrados no banco.');
    }

  } catch (e) {
    console.error('Erro ao consultar banco:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
