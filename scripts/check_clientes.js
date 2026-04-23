const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const clientes = await prisma.cliente.findMany();
  console.log('CLIENTES NO BANCO:');
  console.dir(clientes, { depth: null });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
