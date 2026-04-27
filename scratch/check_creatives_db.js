const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const criativos = await prisma.criativo.findMany({
    take: 20,
    orderBy: { criado_em: 'desc' },
    select: { id: true, nome_anuncio: true, url_midia: true }
  });
  console.log(JSON.stringify(criativos, null, 2));
  process.exit(0);
}

check();
