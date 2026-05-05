const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cliente = await prisma.cliente.findFirst({
    where: { nome: { contains: 'Oratória' } }
  });
  console.log(JSON.stringify(cliente, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
