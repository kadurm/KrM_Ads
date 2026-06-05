const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const slug = 'solutionplace';
  const cliente = await prisma.cliente.findUnique({
    where: { slug },
    include: {
      campanhas: {
        include: {
          metricas: true
        }
      }
    }
  });

  // Agrupar métricas por data normalizada (YYYY-MM-DD)
  const dailySpend = {};
  cliente.campanhas.forEach(camp => {
    const dateGroups = {};
    camp.metricas.forEach(m => {
      const dateStr = new Date(m.data).toISOString().split('T')[0];
      if (!dateGroups[dateStr]) {
        dateGroups[dateStr] = [];
      }
      dateGroups[dateStr].push(m);
    });

    Object.keys(dateGroups).forEach(dateStr => {
      const m = dateGroups[dateStr][0]; // deduplicado
      const spend = Number(m.valor_investido || 0);
      dailySpend[dateStr] = (dailySpend[dateStr] || 0) + spend;
    });
  });

  console.log("=== GASTO DIÁRIO DEDUPLICADO ===");
  const sortedDates = Object.keys(dailySpend).sort();
  sortedDates.forEach(date => {
    if (date.startsWith('2026-05') || date.startsWith('2026-06')) {
      console.log(`${date}: R$ ${dailySpend[date].toFixed(2)}`);
    }
  });

  console.log("\n=== TESTANDO DIAS DE 30 DIAS ===");
  // Vamos testar diferentes janelas de 30 dias terminando em Junho
  for (let endOffset = 0; endOffset < 5; endOffset++) {
    const endDate = new Date('2026-06-05');
    endDate.setDate(endDate.getDate() - endOffset);
    
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 29); // 30 dias no total
    
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    
    let sum = 0;
    sortedDates.forEach(date => {
      if (date >= startStr && date <= endStr) {
        sum += dailySpend[date];
      }
    });
    
    console.log(`Janela ${startStr} até ${endStr} (30 dias): R$ ${sum.toFixed(2)}`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
