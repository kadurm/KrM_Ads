const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const creatives = await prisma.criativo.findMany({
    take: 10,
    orderBy: { id: 'desc' }
  });
  console.log(JSON.stringify(creatives, null, 2));
  process.exit(0);
}

check();
