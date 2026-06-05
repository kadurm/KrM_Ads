const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const clienteSlug = 'solutionplace';
  const cliente = await prisma.cliente.findUnique({
    where: { slug: clienteSlug },
    include: {
      campanhas: {
        include: {
          metricas: true,
          criativos: {
            include: {
              metricas: true
            }
          }
        }
      }
    }
  });

  if (!cliente) {
    console.error('Cliente Solution Place não encontrado.');
    return;
  }

  console.log(`Cliente: ${cliente.nome} (${cliente.id})`);
  console.log(`Meta Account ID: ${cliente.meta_ads_account_id}`);
  console.log(`Total de Campanhas: ${cliente.campanhas.length}`);

  for (const camp of cliente.campanhas) {
    console.log(`\n========================================`);
    console.log(`Campanha: ${camp.nome_gerado}`);
    console.log(`ID Meta: ${camp.meta_id}`);
    console.log(`Objetivo: ${camp.objetivo}`);
    console.log(`Tipo Orçamento: ${camp.tipo_orcamento}`);
    console.log(`Métricas: ${camp.metricas.length} registros`);
    
    // Agregados
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalLeads = 0;
    let totalCompras = 0;
    let totalVisits = 0;
    
    camp.metricas.forEach(m => {
      totalSpend += Number(m.valor_investido || 0);
      totalImpressions += m.impressoes || 0;
      totalClicks += m.cliques || 0;
      totalLeads += m.conversas_leads || 0;
      totalCompras += m.compras || 0;
      totalVisits += m.visitas_perfil || 0;
    });

    console.log(`- Total Investido: R$ ${totalSpend.toFixed(2)}`);
    console.log(`- Total Impressões: ${totalImpressions}`);
    console.log(`- Total Cliques: ${totalClicks}`);
    console.log(`- Total Leads (true leads): ${totalLeads}`);
    console.log(`- Total Compras: ${totalCompras}`);
    console.log(`- Total Visitas Perfil: ${totalVisits}`);
    console.log(`- Custo por Lead (CPL): ${totalLeads > 0 ? 'R$ ' + (totalSpend / totalLeads).toFixed(2) : 'N/A'}`);
    console.log(`- CTR Médio: ${totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) + '%' : 'N/A'}`);

    console.log(`Criativos (${camp.criativos.length}):`);
    camp.criativos.forEach(c => {
      let cSpend = 0;
      let cImpressions = 0;
      let cClicks = 0;
      let cLeads = 0;
      c.metricas.forEach(cm => {
        cSpend += Number(cm.valor_investido || 0);
        cImpressions += cm.impressoes || 0;
        cCliques += cm.cliques || 0;
        cLeads += cm.leads || 0;
      });
      console.log(`  * Anúncio: ${c.nome_anuncio} (Meta ID: ${c.meta_ad_id})`);
      console.log(`    - Investimento: R$ ${cSpend.toFixed(2)} | Leads: ${cLeads} | CTR: ${cImpressions > 0 ? ((cCliques / cImpressions) * 100).toFixed(2) + '%' : 'N/A'}`);
      console.log(`    - Copy (Trecho): ${c.texto_principal ? c.texto_principal.substring(0, 100) + '...' : 'N/A'}`);
    });
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
