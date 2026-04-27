const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Maximiza a resolução de URLs do fbcdn.net para 800px
 * Aplica para padrões: p64x64, p130x130, p320x320, p480x480, s150x150, etc.
 * Exemplo: ..._p64x64_q75... -> ..._p800x800_q75...
 */
const maximizeResolution = (url) => {
  if (!url || !url.includes('fbcdn.net')) return url;
  return url
    .replace(/_p\d+x\d+_q/g, '_p800x800_q')
    .replace(/_s\d+x\d+_q/g, '_s800x800_q')
    .replace(/stp=.*?_p\d+x\d+_q/g, (match) => match.replace(/p\d+x\d+/, 'p800x800'))
    .replace(/stp=.*?_s\d+x\d+_q/g, (match) => match.replace(/s\d+x\d+/, 's800x800'));
};

async function main() {
  console.log('Iniciando correção de URLs de criativos para HD (800px)...');

  // Busca TODOS os criativos com URL do fbcdn.net (domínio das imagens do Meta)
  const ads = await prisma.criativo.findMany({
    where: {
      url_midia: { contains: 'fbcdn.net' }
    }
  });

  console.log(`Encontrados ${ads.length} criativos com URL do fbcdn.net.`);

  let count = 0;
  let skipped = 0;
  for (const ad of ads) {
    const newUrl = maximizeResolution(ad.url_midia);

    if (newUrl !== ad.url_midia) {
      await prisma.criativo.update({
        where: { id: ad.id },
        data: { url_midia: newUrl }
      });
      console.log(`  [HD] ${ad.nome_anuncio.substring(0, 40)}... : ${ad.url_midia.substring(0, 50)}... -> ${newUrl.substring(0, 50)}...`);
      count++;
    } else {
      skipped++;
    }
  }

  console.log(`\n=== Resumo ===`);
  console.log(`Sucesso: ${count} URLs atualizadas para 800px.`);
  console.log(`Já estavam em HD: ${skipped} URLs (nenhuma alteração necessária).`);
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
