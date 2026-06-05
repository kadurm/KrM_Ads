const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const slug = 'solutionplace';
  const cliente = await prisma.cliente.findUnique({ where: { slug } });
  if (!cliente) {
    console.error('Cliente não encontrado.');
    return;
  }

  // Vamos listar as datas disponíveis e somar por dia primeiro
  const metricas = await prisma.metricaCampanha.findMany({
    where: {
      campanha: { cliente_id: cliente.id }
    },
    orderBy: { data: 'asc' }
  });

  console.log(`Total de registros de métricas no DB para Solution Place: ${metricas.length}`);
  if (metricas.length > 0) {
    console.log(`Menor data no DB: ${metricas[0].data.toISOString().split('T')[0]}`);
    console.log(`Maior data no DB: ${metricas[metricas.length - 1].data.toISOString().split('T')[0]}`);
  }

  // Testar soma para os últimos 30 dias a partir da maior data no DB
  // Vamos buscar a maior data
  const maxDate = metricas.length > 0 ? metricas[metricas.length - 1].data : new Date();
  
  // Vamos testar várias janelas de 30 dias:
  // Janela A: 30 dias terminando na data atual (2026-06-04)
  // Janela B: 30 dias terminando na maior data do DB
  // Janela C: Mês de Maio + Junho de 2026
  
  const ranges = [
    { name: 'Janela A (06/05 a 04/06)', start: new Date('2026-05-06T00:00:00.000Z'), end: new Date('2026-06-04T23:59:59.999Z') },
    { name: 'Janela B (05/05 a 03/06)', start: new Date('2026-05-05T00:00:00.000Z'), end: new Date('2026-06-03T23:59:59.999Z') },
    { name: 'Janela C (07/05 a 05/06)', start: new Date('2026-05-07T00:00:00.000Z'), end: new Date('2026-06-05T23:59:59.999Z') },
    { name: 'Janela D (01/05 a 31/05)', start: new Date('2026-05-01T00:00:00.000Z'), end: new Date('2026-05-31T23:59:59.999Z') }
  ];

  for (const r of ranges) {
    const sum = await prisma.metricaCampanha.aggregate({
      where: {
        campanha: { cliente_id: cliente.id },
        data: { gte: r.start, lte: r.end }
      },
      _sum: {
        valor_investido: true
      }
    });
    console.log(`${r.name}: R$ ${Number(sum._sum.valor_investido || 0).toFixed(2)}`);
  }

  // Vamos buscar por dia para entender a distribuição
  const dailySpend = {};
  metricas.forEach(m => {
    const dStr = m.data.toISOString().split('T')[0];
    dailySpend[dStr] = (dailySpend[dStr] || 0) + Number(m.valor_investido);
  });

  console.log('\nGastos diários nos últimos 35 dias cadastrados:');
  const sortedDays = Object.keys(dailySpend).sort();
  const last35Days = sortedDays.slice(-35);
  last35Days.forEach(day => {
    console.log(`  ${day}: R$ ${dailySpend[day].toFixed(2)}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
