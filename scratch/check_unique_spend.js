const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const since = new Date('2026-05-06T00:00:00Z');
  const until = new Date('2026-06-05T23:59:59Z');
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

  if (!cliente) {
    console.error('Cliente não encontrado');
    return;
  }

  console.log(`=== CALCULANDO INVESTIMENTO REAL DE SOLUTION PLACE ===`);
  console.log(`Período: 2026-05-06 a 2026-06-05`);

  let totalDeduplicatedSpend = 0;
  let totalDeduplicatedLeads = 0;
  let totalDeduplicatedClicks = 0;
  let totalDeduplicatedImpressions = 0;

  cliente.campanhas.forEach(camp => {
    // Para cada campanha, agrupar métricas por YYYY-MM-DD
    const dateGroups = {};
    camp.metricas.forEach(m => {
      const d = new Date(m.data);
      if (d >= since && d <= until) {
        const dateStr = d.toISOString().split('T')[0];
        if (!dateGroups[dateStr]) {
          dateGroups[dateStr] = [];
        }
        dateGroups[dateStr].push(m);
      }
    });

    let campSpend = 0;
    let campLeads = 0;
    let campClicks = 0;
    let campImpressions = 0;

    Object.keys(dateGroups).forEach(dateStr => {
      const records = dateGroups[dateStr];
      // Se houver duplicatas, escolhemos a com maior id ou simplesmente a primeira, já que são idênticas.
      // Vamos escolher a que veio do sync padrão ou a maior.
      const bestRecord = records[0];
      campSpend += Number(bestRecord.valor_investido || 0);
      campLeads += bestRecord.conversas_leads || 0;
      campClicks += bestRecord.cliques || 0;
      campImpressions += bestRecord.impressoes || 0;
    });

    totalDeduplicatedSpend += campSpend;
    totalDeduplicatedLeads += campLeads;
    totalDeduplicatedClicks += campClicks;
    totalDeduplicatedImpressions += campImpressions;

    if (campSpend > 0) {
      console.log(`- Campanha: "${camp.nome_gerado}" | ID Meta: ${camp.meta_id} | Spend Deduplicado: R$ ${campSpend.toFixed(2)} | Leads Deduplicados: ${campLeads}`);
    }
  });

  console.log(`\nSoma Total Deduplicada:`);
  console.log(`- Investimento Real: R$ ${totalDeduplicatedSpend.toFixed(2)}`);
  console.log(`- Impressões: ${totalDeduplicatedImpressions}`);
  console.log(`- Cliques: ${totalDeduplicatedClicks}`);
  console.log(`- Leads (True Leads): ${totalDeduplicatedLeads}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
