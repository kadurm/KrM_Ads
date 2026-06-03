const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const clienteName = 'Solution Place';
  const since = new Date('2026-04-01T00:00:00');
  const until = new Date('2026-04-30T23:59:59');

  const dbCliente = await prisma.cliente.findFirst({
    where: { nome: { equals: clienteName, mode: 'insensitive' } }
  });

  if (!dbCliente) {
    console.error('Cliente não encontrado.');
    process.exit(1);
  }

  // Query metrics for campaign level
  const campanhas = await prisma.campanha.findMany({
    where: { cliente_id: dbCliente.id },
    include: {
      metricas: {
        where: {
          data: {
            gte: since,
            lte: until
          }
        }
      }
    }
  });

  console.log(`=== REPORT DRAFT FOR SOLUTION PLACE - APRIL 2026 ===`);
  
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
      id: camp.id,
      nome_gerado: camp.nome_gerado,
      objetivo: camp.objetivo,
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

  console.log('\n--- CAMPAIGN METRICS ---');
  reportCamps.forEach(c => {
    console.log(`Campaign: ${c.nome_gerado}`);
    console.log(`  Spend: R$ ${c.valor_investido.toFixed(2)}`);
    console.log(`  Impressions: ${c.impressoes}`);
    console.log(`  Clicks: ${c.cliques}`);
    console.log(`  Profile Visits (Universal Attribution): ${c.visitas_perfil}`);
    console.log(`  Leads: ${c.conversas_leads}`);
    console.log(`  CPL: R$ ${c.conversas_leads > 0 ? (c.valor_investido / c.conversas_leads).toFixed(2) : '0.00'}`);
    console.log(`  CTR: ${c.impressoes > 0 ? ((c.cliques / c.impressoes) * 100).toFixed(2) + '%' : '0%'}`);
  });

  console.log('\n--- TOTAL ACCOUNT METRICS ---');
  console.log(`Total Spend: R$ ${totals.valor_investido.toFixed(2)}`);
  console.log(`Total Impressions: ${totals.impressoes}`);
  console.log(`Total Clicks: ${totals.cliques}`);
  console.log(`Total Profile Visits: ${totals.visitas_perfil}`);
  console.log(`Total Leads: ${totals.conversas_leads}`);
  console.log(`Overall CPL: R$ ${totals.conversas_leads > 0 ? (totals.valor_investido / totals.conversas_leads).toFixed(2) : '0.00'}`);
  console.log(`Overall CPC: R$ ${totals.cliques > 0 ? (totals.valor_investido / totals.cliques).toFixed(2) : '0.00'}`);
  console.log(`Overall CTR: ${totals.impressoes > 0 ? ((totals.cliques / totals.impressoes) * 100).toFixed(2) + '%' : '0%'}`);
  
  // Calculate best and worst performing campaigns
  const conversionCamps = reportCamps.filter(c => c.conversas_leads > 0);
  const bestCPL = conversionCamps.sort((a, b) => (a.valor_investido / a.conversas_leads) - (b.valor_investido / b.conversas_leads))[0];
  const worstCPL = conversionCamps.sort((a, b) => (b.valor_investido / b.conversas_leads) - (a.valor_investido / a.conversas_leads))[0];

  if (bestCPL) {
    console.log(`\nBest CPL Campaign: ${bestCPL.nome_gerado} (R$ ${(bestCPL.valor_investido / bestCPL.conversas_leads).toFixed(2)})`);
  }
  if (worstCPL) {
    console.log(`Worst CPL Campaign: ${worstCPL.nome_gerado} (R$ ${(worstCPL.valor_investido / worstCPL.conversas_leads).toFixed(2)})`);
  }

  await prisma.$disconnect();
}

main();
