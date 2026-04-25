const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const ads = await prisma.criativo.findMany({
    take: 20,
    orderBy: { criado_em: 'desc' },
    select: { nome_anuncio: true, url_midia: true, meta_ad_id: true, criado_em: true }
  });

  console.log(`Encontrados ${ads.length} criativos recentes.`);
  ads.forEach(ad => {
    console.log(`\nAd: ${ad.nome_anuncio}`);
    console.log(`Criado em: ${ad.criado_em}`);
    console.log(`URL: ${ad.url_midia}`);
  });

  await prisma.$disconnect();
}

main();
