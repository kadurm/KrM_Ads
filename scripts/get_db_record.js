const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.cliente.findFirst({
    where: { nome: { contains: 'Direito Direto', mode: 'insensitive' } }
  });
  if (!c) {
    console.log('Cliente não encontrado');
    return;
  }

  const records = await prisma.metricaCampanha.findMany({
    where: {
      campanha: { cliente_id: c.id },
      data: {
        gte: new Date('2026-05-11T00:00:00.000Z'),
        lte: new Date('2026-05-11T23:59:59.999Z')
      }
    },
    include: { campanha: true }
  });

  console.dir(records, { depth: null });
}

main().catch(console.error).finally(() => prisma.$disconnect());
