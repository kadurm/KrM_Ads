const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const campaign = await prisma.campanha.findFirst({
    where: { meta_id: '52545041016220' }
  });

  if (!campaign) {
    console.log('Campanha não encontrada no DB.');
    await prisma.$disconnect();
    return;
  }

  console.log(`Campanha: ${campaign.nome_gerado} (ID: ${campaign.id})`);

  const creatives = await prisma.criativo.findMany({
    where: { campanha_id: campaign.id },
    include: {
      metricas: {
        where: {
          data: {
            gte: new Date('2026-04-18T00:00:00'),
            lte: new Date('2026-05-18T23:59:59')
          }
        }
      }
    }
  });

  console.log(`Total de criativos encontrados: ${creatives.length}`);

  for (const c of creatives) {
    const totalLeads = c.metricas.reduce((acc, m) => acc + (m.leads || 0), 0);
    const totalSpend = c.metricas.reduce((acc, m) => acc + Number(m.valor_investido || 0), 0);
    console.log(`- Criativo: ${c.nome_anuncio} (ID: ${c.id})`);
    console.log(`  Leads no DB: ${totalLeads}`);
    console.log(`  Investimento no DB: R$ ${totalSpend.toFixed(2)}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
