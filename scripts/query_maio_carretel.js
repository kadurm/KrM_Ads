const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const startPeriod = new Date('2026-05-01T00:00:00.000Z');
  const endPeriod = new Date('2026-05-31T23:59:59.000Z');

  const c = await prisma.cliente.findFirst({
    where: { nome: 'Carretel Aviamentos' }
  });
  if (!c) {
    console.log('Cliente não encontrado');
    return;
  }
  console.log(`=======================================================`);
  console.log(`CONSULTA DE MAIO/2026 - CLIENTE: ${c.nome}`);
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
        alcance: 0,
        cliques: 0,
        visitas_perfil: 0,
        seguidores: 0,
        conversas_leads: 0,
        compras: 0
      };
    }
    campanhasSum[cid].investido += Number(met.valor_investido || 0);
    campanhasSum[cid].impressoes += met.impressoes;
    campanhasSum[cid].alcance += met.alcance;
    campanhasSum[cid].cliques += met.cliques;
    campanhasSum[cid].visitas_perfil += met.visitas_perfil;
    campanhasSum[cid].seguidores += met.seguidores;
    campanhasSum[cid].conversas_leads += met.conversas_leads;
    campanhasSum[cid].compras += met.compras;
  }

  console.log('\nResultados por Campanha em Maio/2026 no Banco:');
  Object.values(campanhasSum).forEach(camp => {
    console.log(`\nCampanha: ${camp.nome} (${camp.objetivo})`);
    console.log(`  - Investido: R$ ${camp.investido.toFixed(2)}`);
    console.log(`  - Impressões: ${camp.impressoes}`);
    console.log(`  - Alcance: ${camp.alcance}`);
    console.log(`  - Cliques: ${camp.cliques}`);
    console.log(`  - Visitas ao Perfil: ${camp.visitas_perfil}`);
    console.log(`  - Seguidores Gerados (Follows/Likes): ${camp.seguidores}`);
    console.log(`  - Conversas de Leads (Meta): ${camp.conversas_leads}`);
    console.log(`  - Compras: ${camp.compras}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
