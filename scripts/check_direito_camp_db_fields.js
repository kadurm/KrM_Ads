const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.campanha.findUnique({
    where: { meta_id: '120249480706290746' }
  });
  console.log('=== CAMPAIGN IN DB ===');
  console.dir(c, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
