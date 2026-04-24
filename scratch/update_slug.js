const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cliente = await prisma.cliente.findFirst({
    where: { nome: { contains: 'Solution' } }
  });

  if (cliente) {
    const updated = await prisma.cliente.update({
      where: { id: cliente.id },
      data: { slug: 'solutionplace' }
    });
    console.log('Slug atualizado para:', updated.slug);
  } else {
    console.log('Cliente Solution não encontrado.');
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
