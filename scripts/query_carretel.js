const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.cliente.findFirst({
    where: { nome: 'Carretel Aviamentos' }
  });
  if (!c) {
    console.log('Cliente não encontrado');
    return;
  }
  console.log(`Cliente: ${c.nome} (ID: ${c.id}, Account ID: ${c.meta_ads_account_id})`);

  const campanhas = await prisma.campanha.findMany({
    where: { cliente_id: c.id },
    include: {
      metricas: {
        orderBy: { data: 'asc' }
      }
    }
  });

  console.log(`\nCampanhas encontradas: ${campanhas.length}`);
  for (const camp of campanhas) {
    console.log(`\nCampanha: ${camp.nome_gerado} (Meta ID: ${camp.meta_id})`);
    console.log(`Objetivo: ${camp.objetivo}, Tipo Orçamento: ${camp.tipo_orcamento}`);
    console.log(`Métricas Diárias:`);
    let totalInvestido = 0;
    let totalCliques = 0;
    let totalImpressoes = 0;
    let totalLeads = 0;
    let totalCompras = 0;
    
    for (const met of camp.metricas) {
      const dataStr = met.data.toISOString().split('T')[0];
      console.log(`  - Data: ${dataStr} | Investido: R$ ${met.valor_investido} | Cliques: ${met.cliques} | Impressões: ${met.impressoes} | Leads: ${met.conversas_leads} | Compras: ${met.compras}`);
      totalInvestido += Number(met.valor_investido || 0);
      totalCliques += met.cliques;
      totalImpressoes += met.impressoes;
      totalLeads += met.conversas_leads;
      totalCompras += met.compras;
    }
    console.log(`  => TOTAL: Investido: R$ ${totalInvestido.toFixed(2)} | Cliques: ${totalCliques} | Impressões: ${totalImpressoes} | Leads: ${totalLeads} | Compras: ${totalCompras}`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
