const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getPeriodReport(dbCliente, sinceDate, untilDate, label) {
  const campanhas = await prisma.campanha.findMany({
    where: { cliente_id: dbCliente.id },
    include: {
      metricas: {
        where: {
          data: {
            gte: sinceDate,
            lte: untilDate
          }
        }
      }
    }
  });

  const reportCamps = campanhas.map(camp => {
    const total = camp.metricas.reduce((acc, m) => ({
      impressoes: acc.impressoes + m.impressoes,
      alcance: Math.max(acc.alcance, m.alcance),
      cliques: acc.cliques + m.cliques,
      visitas_perfil: acc.visitas_perfil + m.visitas_perfil,
      seguidores: acc.seguidores + m.seguidores,
      conversas_leads: acc.conversas_leads + m.conversas_leads,
      valor_investido: acc.valor_investido + Number(m.valor_investido),
      compras: acc.compras + m.compras,
      valor_compras: acc.valor_compras + Number(m.valor_compras || 0)
    }), { impressoes: 0, alcance: 0, cliques: 0, visitas_perfil: 0, seguidores: 0, conversas_leads: 0, valor_investido: 0, compras: 0, valor_compras: 0 });

    return {
      nome_gerado: camp.nome_gerado,
      ...total
    };
  }).filter(c => c.impressoes > 0 || c.valor_investido > 0);

  const totals = reportCamps.reduce((acc, c) => ({
    impressoes: acc.impressoes + c.impressoes,
    alcance: acc.alcance + c.alcance,
    cliques: acc.cliques + c.cliques,
    visitas_perfil: acc.visitas_perfil + c.visitas_perfil,
    seguidores: acc.seguidores + c.seguidores,
    conversas_leads: acc.conversas_leads + c.conversas_leads,
    valor_investido: acc.valor_investido + c.valor_investido,
    compras: acc.compras + c.compras,
    valor_compras: acc.valor_compras + c.valor_compras
  }), { impressoes: 0, alcance: 0, cliques: 0, visitas_perfil: 0, seguidores: 0, conversas_leads: 0, valor_investido: 0, compras: 0, valor_compras: 0 });

  console.log(`\n=== CONSOLIDADO ${label.toUpperCase()} ===`);
  console.log(`Investimento: R$ ${totals.valor_investido.toFixed(2)}`);
  console.log(`Impressoes: ${totals.impressoes}`);
  console.log(`Cliques: ${totals.cliques}`);
  console.log(`Perfil/Instagram Visits: ${totals.visitas_perfil}`);
  console.log(`Leads Reais: ${totals.conversas_leads}`);
  console.log(`CPL Medio: R$ ${totals.conversas_leads > 0 ? (totals.valor_investido / totals.conversas_leads).toFixed(2) : '0.00'}`);
  console.log(`CPC Medio: R$ ${totals.cliques > 0 ? (totals.valor_investido / totals.cliques).toFixed(2) : '0.00'}`);
  console.log(`CTR Medio: ${totals.impressoes > 0 ? ((totals.cliques / totals.impressoes) * 100).toFixed(2) + '%' : '0%'}`);
  
  console.log(`\nDetalhes de Campanhas (${label}):`);
  reportCamps.forEach(c => {
    console.log(`- ${c.nome_gerado}:`);
    console.log(`  Spend: R$ ${c.valor_investido.toFixed(2)} | Leads: ${c.conversas_leads} | CPL: R$ ${c.conversas_leads > 0 ? (c.valor_investido / c.conversas_leads).toFixed(2) : '0.00'} | Clicks: ${c.cliques}`);
  });
}

async function main() {
  const clienteName = 'Carretel Aviamentos';
  
  const dbCliente = await prisma.cliente.findFirst({
    where: { nome: { equals: clienteName, mode: 'insensitive' } }
  });

  if (!dbCliente) {
    console.error('Cliente não encontrado.');
    process.exit(1);
  }

  // 1. Report for April
  await getPeriodReport(
    dbCliente, 
    new Date('2026-04-01T00:00:00.000Z'), 
    new Date('2026-04-30T23:59:59.999Z'), 
    'Abril 2026'
  );

  // 2. Report for May
  await getPeriodReport(
    dbCliente, 
    new Date('2026-05-01T00:00:00.000Z'), 
    new Date('2026-05-31T23:59:59.999Z'), 
    'Maio 2026'
  );

  await prisma.$disconnect();
}

main();
