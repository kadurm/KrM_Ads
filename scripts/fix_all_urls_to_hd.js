const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando correção de URLs de criativos para HD (800px)...');
  
  const ads = await prisma.criativo.findMany({
    where: {
      OR: [
        { url_midia: { contains: 'p64x64' } },
        { url_midia: { contains: 'p130x130' } },
        { url_midia: { contains: 'p160x160' } },
        { url_midia: { contains: 'p320x320' } },
        { url_midia: { contains: 'p480x480' } }
      ]
    }
  });

  console.log(`Encontrados ${ads.length} criativos com baixa resolução.`);

  let count = 0;
  for (const ad of ads) {
    const newUrl = ad.url_midia.replace(/p\d+x\d+/, 'p800x800');
    
    if (newUrl !== ad.url_midia) {
      await prisma.criativo.update({
        where: { id: ad.id },
        data: { url_midia: newUrl }
      });
      count++;
    }
  }

  console.log(`Sucesso: ${count} URLs atualizadas para 800px.`);
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
