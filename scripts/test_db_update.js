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

  const record = await prisma.metricaCampanha.findFirst({
    where: {
      campanha: { cliente_id: c.id },
      data: new Date('2026-05-11T00:00:00.000Z')
    }
  });

  if (!record) {
    console.log('Record not found');
    return;
  }

  console.log('Before update: cliques =', record.cliques, ', visitas =', record.visitas_perfil);

  const updated = await prisma.metricaCampanha.update({
    where: { id: record.id },
    data: { visitas_perfil: 41 }
  });

  console.log('After update: cliques =', updated.cliques, ', visitas =', updated.visitas_perfil);
}

main().catch(console.error).finally(() => prisma.$disconnect());
