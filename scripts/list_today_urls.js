const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cliente = await prisma.cliente.findFirst({ where: { nome: 'Solution Place' } });
  if (!cliente) return;

  const today = new Date();
  today.setHours(0,0,0,0);

  const ads = await prisma.criativo.findMany({
    where: {
      campanha: { cliente_id: cliente.id },
      metricas: { some: { data: { gte: today } } }
    },
    select: { nome_anuncio: true, url_midia: true, meta_ad_id: true }
  });

  console.log(`Encontrados ${ads.length} criativos hoje.`);
  ads.forEach(ad => {
    console.log(`\nAd: ${ad.nome_anuncio}`);
    console.log(`MetaID: ${ad.meta_ad_id}`);
    console.log(`URL: ${ad.url_midia}`);
  });

  await prisma.$disconnect();
}

main();
