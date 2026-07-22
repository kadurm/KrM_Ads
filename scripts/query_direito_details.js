const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.cliente.findFirst({
    where: { nome: { contains: 'Direito Direto', mode: 'insensitive' } }
  });
  console.log('CLIENTE DIREITO DIRETO DETAILS:');
  console.dir(c, { depth: null });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
