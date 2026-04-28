const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyze() {
  console.log('--- ANÁLISE PROFUNDA: AD[02/03/26] vs DEMAIS ---');

  const ids = ['120241680258160488', '120241432561070488', '120241510675010488'];

  for (const metaId of ids) {
    const ad = await prisma.criativo.findFirst({
      where: { meta_ad_id: metaId },
      include: {
        campanha: true,
        metricas: true
      }
    });

    if (ad) {
      console.log(`\n>>> ANÚNCIO: ${ad.nome_anuncio} (Meta ID: ${ad.meta_ad_id})`);
      console.log(`    Campanha: ${ad.campanha?.nome_gerado || 'N/A'}`);
      console.log(`    URL Mídia: ${ad.url_midia ? 'PRESENTE' : 'AUSENTE (undefined/null)'}`);
      if (ad.url_midia) console.log(`    URL: ${ad.url_midia.substring(0, 50)}...`);
      console.log(`    Métricas (Total registros: ${ad.metricas.length})`);

      const totalSpend = ad.metricas.reduce((acc, m) => acc + (Number(m.valor_investido) || 0), 0);
      const totalLeads = ad.metricas.reduce((acc, m) => acc + (Number(m.leads) || 0), 0);
      const totalClicks = ad.metricas.reduce((acc, m) => acc + (Number(m.cliques) || 0), 0);

      console.log(`    RESUMO: Invest: ${totalSpend.toFixed(2)} | Leads: ${totalLeads} | Cliques: ${totalClicks}`);
    }
  }

  // Comparar com um AD que "funciona"
  const workingAdName = 'AD[07/04/26]';
  const workingAd = await prisma.criativo.findFirst({
    where: { nome_anuncio: { contains: workingAdName } },
    include: { metricas: true }
  });

  if (workingAd) {
    console.log(`\n--- COMPARAÇÃO COM CONTROLE: ${workingAd.nome_anuncio} ---`);
    console.log(`    URL Mídia: ${workingAd.url_midia ? 'PRESENTE' : 'AUSENTE'}`);
    const totalSpend = workingAd.metricas.reduce((acc, m) => acc + (Number(m.valor_investido) || 0), 0);
    console.log(`    Investimento Total: ${totalSpend.toFixed(2)}`);
  }

  await prisma.$disconnect();
}

analyze();
