const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const campaignId = 'e48b1f0b-102a-49d1-b5b0-067a5c5b61b1'; // ID da campanha do Maio
  const today = new Date('2026-05-18T00:00:00');
  const valorAdicionar = 7 * 280; // 1960.00

  console.log(`Adicionando R$ ${valorAdicionar} ao faturamento da campanha ${campaignId} em ${today.toISOString().split('T')[0]}`);

  const existingMetric = await prisma.metricaCampanha.findUnique({
    where: { campanha_id_data: { campanha_id: campaignId, data: today } }
  });

  if (existingMetric) {
    const currentFaturamento = Number(existingMetric.faturamento_manual || 0);
    const newFaturamento = currentFaturamento + valorAdicionar;
    
    await prisma.metricaCampanha.update({
      where: { id: existingMetric.id },
      data: { faturamento_manual: newFaturamento }
    });
    console.log(`Faturamento atualizado de R$ ${currentFaturamento} para R$ ${newFaturamento}`);
  } else {
    await prisma.metricaCampanha.create({
      data: {
        campanha_id: campaignId,
        data: today,
        faturamento_manual: valorAdicionar,
        impressoes: 0,
        alcance: 0,
        cliques: 0,
        visitas_perfil: 0,
        seguidores: 0,
        conversas_leads: 0,
        reacoes_sociais: 0,
        valor_investido: 0.0,
        compras: 7 // Also add to compras (sales count)
      }
    });
    console.log(`Nova métrica criada com faturamento de R$ ${valorAdicionar}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
