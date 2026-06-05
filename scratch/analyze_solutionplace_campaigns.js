const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== Iniciando Análise de Campanhas da Solution Place ===');
  
  const cliente = await prisma.cliente.findFirst({
    where: {
      OR: [
        { slug: 'solutionplace' },
        { nome: 'Solution Place' }
      ]
    }
  });

  if (!cliente) {
    console.error('Erro: Cliente "Solution Place" não encontrado no banco de dados.');
    return;
  }

  console.log(`Cliente encontrado: ${cliente.nome} (${cliente.id})`);
  console.log(`Setor: ${cliente.setor}`);
  console.log(`Ad Account ID: ${cliente.meta_ads_account_id}`);

  // Buscar todas as campanhas e suas métricas
  const campanhas = await prisma.campanha.findMany({
    where: { cliente_id: cliente.id },
    include: {
      metricas: {
        orderBy: { data: 'desc' }
      }
    }
  });

  console.log(`Total de campanhas cadastradas no banco: ${campanhas.length}\n`);

  if (campanhas.length === 0) {
    console.log('Nenhuma campanha encontrada no banco de dados.');
    return;
  }

  campanhas.forEach(camp => {
    const totalImpressoes = camp.metricas.reduce((sum, m) => sum + m.impressoes, 0);
    const totalAlcance = camp.metricas.reduce((sum, m) => sum + m.alcance, 0);
    const totalCliques = camp.metricas.reduce((sum, m) => sum + m.cliques, 0);
    const totalVisitas = camp.metricas.reduce((sum, m) => sum + m.visitas_perfil, 0);
    const totalLeads = camp.metricas.reduce((sum, m) => sum + m.conversas_leads, 0);
    const totalSpend = camp.metricas.reduce((sum, m) => sum + Number(m.valor_investido), 0);
    const totalCompras = camp.metricas.reduce((sum, m) => sum + m.compras, 0);
    const totalValorCompras = camp.metricas.reduce((sum, m) => sum + Number(m.valor_compras || 0), 0);

    const cpl = totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : '0.00';
    const cpc = totalCliques > 0 ? (totalSpend / totalCliques).toFixed(2) : '0.00';
    const ctr = totalImpressoes > 0 ? ((totalCliques / totalImpressoes) * 100).toFixed(2) : '0.00';
    const roas = totalSpend > 0 ? (totalValorCompras / totalSpend).toFixed(2) : '0.00';

    console.log(`----------------------------------------`);
    console.log(`Campanha: ${camp.nome_gerado}`);
    console.log(`Meta ID: ${camp.meta_id}`);
    console.log(`Objetivo: ${camp.objetivo}`);
    console.log(`Investimento Total: R$ ${totalSpend.toFixed(2)}`);
    console.log(`Leads Gerados (Mensagens): ${totalLeads} (CPL: R$ ${cpl})`);
    console.log(`Cliques no Link: ${totalCliques} (CPC: R$ ${cpc} | CTR: ${ctr}%)`);
    console.log(`Visitas Perfil: ${totalVisitas}`);
    console.log(`Compras Registradas: ${totalCompras} (Valor total: R$ ${totalValorCompras.toFixed(2)} | ROAS: ${roas})`);
    console.log(`Última métrica em: ${camp.metricas[0] ? camp.metricas[0].data.toISOString().split('T')[0] : 'N/A'}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
