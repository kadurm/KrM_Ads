const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const startPeriod = new Date('2026-05-01T00:00:00.000Z');
  const endPeriod = new Date('2026-05-31T23:59:59.000Z');

  const c = await prisma.cliente.findFirst({
    where: { nome: { contains: 'Direito Direto', mode: 'insensitive' } }
  });
  if (!c) {
    console.log('Cliente não encontrado');
    return;
  }
  console.log(`=======================================================`);
  console.log(`CONSULTA DE MAIO/2026 - CLIENTE: ${c.nome}`);
  console.log(`ID: ${c.id} | Account: ${c.meta_ads_account_id}`);
  console.log(`=======================================================`);

  const metricasCampanha = await prisma.metricaCampanha.findMany({
    where: {
      campanha: { cliente_id: c.id },
      data: {
        gte: startPeriod,
        lte: endPeriod
      }
    },
    include: {
      campanha: true
    }
  });

  const campanhasSum = {};

  for (const met of metricasCampanha) {
    const cid = met.campanha.id;
    if (!campanhasSum[cid]) {
      campanhasSum[cid] = {
        nome: met.campanha.nome_gerado,
        meta_id: met.campanha.meta_id,
        objetivo: met.campanha.objetivo,
        investido: 0,
        impressoes: 0,
        cliques: 0,
        visitas_perfil: 0,
        conversas_leads: 0
      };
    }
    campanhasSum[cid].investido += Number(met.valor_investido || 0);
    campanhasSum[cid].impressoes += met.impressoes;
    campanhasSum[cid].cliques += met.cliques;
    campanhasSum[cid].visitas_perfil += met.visitas_perfil;
    campanhasSum[cid].conversas_leads += met.conversas_leads;
  }

  console.log('\nResultados no Banco:');
  Object.values(campanhasSum).forEach(camp => {
    console.log(`\nCampanha: ${camp.nome} (${camp.objetivo})`);
    console.log(`  - Investido: R$ ${camp.investido.toFixed(2)}`);
    console.log(`  - Impressões: ${camp.impressoes}`);
    console.log(`  - Cliques: ${camp.cliques}`);
    console.log(`  - Visitas ao Perfil (Banco): ${camp.visitas_perfil}`);
    console.log(`  - Leads (Banco): ${camp.conversas_leads}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
