const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const r = await prisma.relatorio.findUnique({
    where: { id: 'a8c58106-d532-4361-acce-1d2022a9ca61' }
  });
  console.log('CONTEÚDO DO RELATÓRIO DO BANCO DE DADOS:');
  console.dir(r, { depth: null });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
