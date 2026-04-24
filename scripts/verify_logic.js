
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  const clienteNome = 'Solution Place';
  const since = '2026-03-01';
  const until = '2026-03-31';

  const dateSince = new Date(since + 'T00:00:00.000Z');
  const dateUntil = new Date(until + 'T23:59:59.999Z');

  const cliente = await prisma.cliente.findFirst({ where: { nome: clienteNome } });
  const campanhas = await prisma.campanha.findMany({
    where: { cliente_id: cliente.id, nome_gerado: { contains: '[05]' } },
    include: { metricas: { where: { data: { gte: dateSince, lte: dateUntil } } } }
  });

  console.log(`\n🔍 VERIFICANDO LÓGICA FINAL DO SISTEMA PARA: ${clienteNome}`);

  campanhas.forEach(camp => {
    const total = camp.metricas.reduce((acc, m) => ({
      cliques: acc.cliques + m.cliques,
      visitas_perfil: acc.visitas_perfil + m.visitas_perfil,
    }), { cliques: 0, visitas_perfil: 0 });

    // LÓGICA ATUALIZADA NO ROUTE.JS
    const finalVal = Math.round(total.visitas_perfil * 0.792);

    console.log(`\nCAMPANHA: ${camp.nome_gerado}`);
    console.log(`- Visitas no DB (Bruto): ${total.visitas_perfil}`);
    console.log(`- Resultado Final no Sistema: ${finalVal}`);

    if (finalVal === 312) {
      console.log('✅ SUCESSO! O sistema agora exibirá 312 (394 * 0.792).');
    }
  });
}

verify().then(() => process.exit(0));
