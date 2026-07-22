const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.cliente.findFirst({
    where: { nome: { contains: 'Carretel Aviamentos', mode: 'insensitive' } }
  });
  if (!c) {
    console.log('Cliente não encontrado');
    return;
  }

  const criativos = await prisma.criativo.findMany({
    where: { campanha: { cliente_id: c.id } },
    include: {
      campanha: true,
      metricas: {
        where: {
          data: {
            gte: new Date('2026-05-01T00:00:00.000Z'),
            lte: new Date('2026-05-31T23:59:59.000Z')
          }
        }
      }
    }
  });

  console.log(`=======================================================`);
  console.log(`CREATIVE LEADS FOR CARRETEL AVIAMENTOS - MAY 2026:`);
  console.log(`=======================================================`);

  let grandTotalLeads = 0;

  criativos.forEach(cr => {
    const totalLeads = cr.metricas.reduce((acc, m) => acc + m.leads, 0);
    const totalSpend = cr.metricas.reduce((acc, m) => acc + Number(m.valor_investido), 0);
    if (totalLeads > 0 || totalSpend > 0) {
      console.log(`Creative: ${cr.nome_anuncio} (${cr.meta_ad_id})`);
      console.log(`  - Campanha: ${cr.campanha?.nome_gerado} (${cr.campanha?.objetivo})`);
      console.log(`  - Leads: ${totalLeads}`);
      console.log(`  - Spend: R$ ${totalSpend.toFixed(2)}`);
      grandTotalLeads += totalLeads;
    }
  });

  console.log(`\nGrand Total Creative Leads in May 2026: ${grandTotalLeads}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
