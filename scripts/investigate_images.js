const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const workingAds = [
    'AD[07/04/26]', 'AD[30/03/26]', 'AD[18/03/26]', 
    'AD2[19/04/26]', 'AD[04/04/26]', 'AD[11/04/26]'
  ];

  console.log('--- INVESTIGANDO ANÚNCIOS FUNCIONANDO ---');
  for (const nome of workingAds) {
    const ads = await prisma.criativo.findMany({
      where: { nome_anuncio: { contains: nome } },
      select: { id: true, nome_anuncio: true, url_midia: true, meta_ad_id: true }
    });
    
    console.log(`\nAnúncio: ${nome}`);
    ads.forEach(ad => {
      console.log(`  ID: ${ad.id} | MetaID: ${ad.meta_ad_id}`);
      console.log(`  URL: ${ad.url_midia?.substring(0, 100)}...`);
    });
  }

  console.log('\n--- INVESTIGANDO ANÚNCIOS COM POSSÍVEL BAIXA RESOLUÇÃO (HOJE) ---');
  // Busca anúncios sincronizados hoje que não estão na lista de funcionando
  const today = new Date();
  today.setHours(0,0,0,0);

  const recentAds = await prisma.criativo.findMany({
    where: {
      metricas: {
        some: {
          data: { gte: today }
        }
      }
    },
    select: { id: true, nome_anuncio: true, url_midia: true, meta_ad_id: true }
  });

  recentAds.forEach(ad => {
    if (!workingAds.some(w => ad.nome_anuncio.includes(w))) {
      console.log(`\nAnúncio Baixa Res?: ${ad.nome_anuncio}`);
      console.log(`  ID: ${ad.id} | MetaID: ${ad.meta_ad_id}`);
      console.log(`  URL: ${ad.url_midia?.substring(0, 100)}...`);
    }
  });

  await prisma.$disconnect();
}

main();
