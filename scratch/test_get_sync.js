const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testGet() {
  const cliente = 'Solution Place';
  const dbCliente = await prisma.cliente.findFirst({ where: { nome: cliente } });
  
  // Simulate the GET logic
  const dateSince = new Date('2026-01-01');
  const dateUntil = new Date('2026-04-26');
  
  const criativosRaw = await prisma.criativo.findMany({
    where: { campanha: { cliente_id: dbCliente.id } },
    include: { metricas: { where: { data: { gte: dateSince, lte: dateUntil } } } }
  });
  
  const aggregated = {};
  for (const ad of criativosRaw) {
    const stats = ad.metricas.reduce((acc, curr) => ({
      impressoes: acc.impressoes + Number(curr.impressoes || 0),
      valor_investido: acc.valor_investido + Number(curr.valor_investido || 0),
      leads: acc.leads + Number(curr.conversas_leads || 0)
    }), { impressoes: 0, valor_investido: 0, leads: 0 });
    
    if (stats.impressoes > 0 || stats.valor_investido > 0) {
      aggregated[ad.nome_anuncio] = {
        nome: ad.nome_anuncio,
        url: ad.url_midia,
        ...stats
      };
    }
  }
  
  console.log('Aggregated results for first 5:');
  console.log(JSON.stringify(Object.values(aggregated).slice(0, 5), null, 2));
  process.exit(0);
}

testGet();
