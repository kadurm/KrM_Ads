const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const slug = 'solutionplace';
  const cliente = await prisma.cliente.findUnique({
    where: { slug },
    include: {
      campanhas: {
        include: {
          metricas: {
            orderBy: { data: 'asc' }
          }
        }
      }
    }
  });

  if (!cliente) {
    console.error('Cliente não encontrado');
    return;
  }

  console.log(`Cliente: ${cliente.nome}`);
  
  // Total de registros no banco
  let totalRows = 0;
  let allTimeSpend = 0;
  const spendByDate = {};

  cliente.campanhas.forEach(camp => {
    camp.metricas.forEach(m => {
      totalRows++;
      const dateStr = m.data.toISOString().split('T')[0];
      const spend = Number(m.valor_investido || 0);
      allTimeSpend += spend;
      spendByDate[dateStr] = (spendByDate[dateStr] || 0) + spend;
    });
  });

  console.log(`Total de registros de métricas de campanha no banco: ${totalRows}`);
  console.log(`Valor investido total histórico (sem filtro de data): R$ ${allTimeSpend.toFixed(2)}`);

  console.log('\nInvestimento por dia cadastrado no banco:');
  const sortedDates = Object.keys(spendByDate).sort();
  sortedDates.forEach(date => {
    console.log(`- ${date}: R$ ${spendByDate[date].toFixed(2)}`);
  });

  // Filtrando pelos últimos 30 dias (2026-05-06 a 2026-06-05)
  const since = new Date('2026-05-06T00:00:00Z');
  const until = new Date('2026-06-05T23:59:59Z');
  let rangeSpend = 0;
  let rangeLeads = 0;
  let rangeClicks = 0;
  let rangeImpressions = 0;

  cliente.campanhas.forEach(camp => {
    camp.metricas.forEach(m => {
      const d = new Date(m.data);
      if (d >= since && d <= until) {
        rangeSpend += Number(m.valor_investido || 0);
        rangeLeads += m.conversas_leads || 0;
        rangeClicks += m.cliques || 0;
        rangeImpressions += m.impressoes || 0;
      }
    });
  });

  console.log(`\n--- FILTRADO PARA O PERÍODO 2026-05-06 A 2026-06-05 ---`);
  console.log(`Investimento: R$ ${rangeSpend.toFixed(2)}`);
  console.log(`Impressões: ${rangeImpressions}`);
  console.log(`Cliques: ${rangeClicks}`);
  console.log(`Leads: ${rangeLeads}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
