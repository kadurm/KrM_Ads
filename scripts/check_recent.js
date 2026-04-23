const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const clienteNome = 'Solution Place';
  try {
    const c = await prisma.cliente.findFirst({ where: { nome: clienteNome } });
    const today = new Date('2026-04-23T00:00:00.000Z');
    const yesterday = new Date('2026-04-22T00:00:00.000Z');

    const tData = await prisma.metricaCampanha.findMany({
      where: { campanha: { cliente_id: c.id }, data: today },
      include: { campanha: true }
    });

    const yData = await prisma.metricaCampanha.findMany({
      where: { campanha: { cliente_id: c.id }, data: yesterday },
      include: { campanha: true }
    });

    console.log(`\n📅 VERIFICAÇÃO DE DADOS RECENTES - ${clienteNome}`);
    console.log('------------------------------------------');
    console.log(`HOJE (23/04): ${tData.length} campanhas com dados`);
    tData.forEach(d => console.log(` - ${d.campanha.nome_gerado}: R$ ${d.valor_investido}`));
    
    console.log(`\nONTEM (22/04): ${yData.length} campanhas com dados`);
    yData.forEach(d => console.log(` - ${d.campanha.nome_gerado}: R$ ${d.valor_investido}`));
    console.log('------------------------------------------');

  } catch (e) {
    console.error('Erro:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
