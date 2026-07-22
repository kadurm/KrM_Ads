const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const startPeriod = new Date('2026-05-11T00:00:00.000Z');
  const endPeriod = new Date('2026-06-10T23:59:59.000Z');

  const c = await prisma.cliente.findFirst({
    where: { nome: 'Carretel Aviamentos' }
  });
  if (!c) {
    console.log('Cliente não encontrado');
    return;
  }
  console.log(`=======================================================`);
  console.log(`AUDITORIA DO CLIENTE: ${c.nome}`);
  console.log(`Período de Análise: 11/05/2026 a 10/06/2026`);
  console.log(`=======================================================`);

  // 1. Métricas de Meta Ads (Métricas de Campanha do Período)
  const metricasCampanha = await prisma.metricaCampanha.findMany({
    where: {
      campanha: { cliente_id: c.id },
      data: {
        gte: startPeriod,
        lte: endPeriod
      }
    },
    include: {
      campanha: true
    }
  });

  console.log(`\n--- DADOS DE ANÚNCIOS (META ADS) ---`);
  
  let totalInvestido = 0;
  let totalImpressoes = 0;
  let totalCliques = 0;
  let totalLeadsMeta = 0; // leads apontados pelas métricas da Meta
  let totalComprasMeta = 0;
  let valorComprasMeta = 0;
  
  // Agrupar por campanha
  const campanhasSum = {};

  for (const met of metricasCampanha) {
    const cid = met.campanha.id;
    if (!campanhasSum[cid]) {
      campanhasSum[cid] = {
        nome: met.campanha.nome_gerado,
        meta_id: met.campanha.meta_id,
        objetivo: met.campanha.objetivo,
        investido: 0,
        impressoes: 0,
        cliques: 0,
        leads: 0,
        compras: 0
      };
    }
    campanhasSum[cid].investido += Number(met.valor_investido || 0);
    campanhasSum[cid].impressoes += met.impressoes;
    campanhasSum[cid].cliques += met.cliques;
    campanhasSum[cid].leads += met.conversas_leads;
    campanhasSum[cid].compras += met.compras;

    totalInvestido += Number(met.valor_investido || 0);
    totalImpressoes += met.impressoes;
    totalCliques += met.cliques;
    totalLeadsMeta += met.conversas_leads;
    totalComprasMeta += met.compras;
    valorComprasMeta += Number(met.valor_compras || 0);
  }

  const listCampanhas = Object.values(campanhasSum);
  listCampanhas.forEach(camp => {
    const ctr = camp.impressoes > 0 ? (camp.cliques / camp.impressoes) * 100 : 0;
    const cpa = camp.leads > 0 ? (camp.investido / camp.leads) : 0;
    console.log(`Campanha: ${camp.nome} (${camp.objetivo})`);
    console.log(`  - Investido: R$ ${camp.investido.toFixed(2)}`);
    console.log(`  - Impressões: ${camp.impressoes} | Cliques: ${camp.cliques} (CTR: ${ctr.toFixed(2)}%)`);
    console.log(`  - Leads (WhatsApp/Meta): ${camp.leads} (CPA: R$ ${cpa.toFixed(2)})`);
    console.log(`  - Compras: ${camp.compras}`);
  });

  const ctrGeral = totalImpressoes > 0 ? (totalCliques / totalImpressoes) * 100 : 0;
  const cpaGeral = totalLeadsMeta > 0 ? (totalInvestido / totalLeadsMeta) : 0;
  console.log(`\nTOTAL META ADS:`);
  console.log(`  - Investimento Total: R$ ${totalInvestido.toFixed(2)}`);
  console.log(`  - Cliques Totais: ${totalCliques} | Impressões Totais: ${totalImpressoes} (CTR Geral: ${ctrGeral.toFixed(2)}%)`);
  console.log(`  - Leads Reportados pela Meta: ${totalLeadsMeta} (CPA Médio: R$ ${cpaGeral.toFixed(2)})`);
  console.log(`  - Compras Reportadas pela Meta: ${totalComprasMeta} (Valor: R$ ${valorComprasMeta.toFixed(2)})`);

  // 2. Leads no CRM/Sistema (Tabela Lead)
  const leadsCRM = await prisma.lead.findMany({
    where: {
      cliente_id: c.id,
      data: {
        gte: startPeriod,
        lte: endPeriod
      }
    }
  });

  console.log(`\n--- DADOS DO SISTEMA (CRM INTERNO) ---`);
  console.log(`Total de Leads Registrados no CRM: ${leadsCRM.length}`);

  // Agrupar leads por status
  const statusCount = {};
  let faturamentoReal = 0;
  let valorNegociacao = 0;
  let leadsFechados = 0;

  for (const lead of leadsCRM) {
    statusCount[lead.status] = (statusCount[lead.status] || 0) + 1;
    const val = Number(lead.valor || 0);
    if (lead.status === 'FECHADO') {
      faturamentoReal += val;
      leadsFechados++;
    } else if (lead.status === 'NEGOCIACAO') {
      valorNegociacao += val;
    }
  }

  console.log(`Distribuição por Status no CRM:`);
  Object.entries(statusCount).forEach(([status, count]) => {
    console.log(`  - ${status}: ${count} leads`);
  });

  console.log(`\nFaturamento Real (Leads Fechados): R$ ${faturamentoReal.toFixed(2)}`);
  console.log(`Valor em Negociação (Pipelines ativos): R$ ${valorNegociacao.toFixed(2)}`);
  
  // Calcular ROI e métricas reais
  const roasReal = totalInvestido > 0 ? (faturamentoReal / totalInvestido) : 0;
  const cacReal = leadsFechados > 0 ? (totalInvestido / leadsFechados) : 0;
  const cplReal = leadsCRM.length > 0 ? (totalInvestido / leadsCRM.length) : 0;

  console.log(`\nMÉTRICAS DE EFICIÊNCIA REAL (AUDITADA):`);
  console.log(`  - Custo Por Lead Real (Investimento / Leads CRM): R$ ${cplReal.toFixed(2)}`);
  console.log(`  - Custo de Aquisição de Cliente Real (CAC Real): R$ ${cacReal.toFixed(2)}`);
  console.log(`  - ROAS Real (Faturamento CRM / Investimento): ${roasReal.toFixed(2)}x`);

  // 3. Ranking de Criativos por CPA no Período
  const metricasCriativo = await prisma.metricaCriativo.findMany({
    where: {
      criativo: { campanha: { cliente_id: c.id } },
      data: {
        gte: startPeriod,
        lte: endPeriod
      }
    },
    include: {
      criativo: true
    }
  });

  const criativosSum = {};
  for (const met of metricasCriativo) {
    const cid = met.criativo.id;
    if (!criativosSum[cid]) {
      criativosSum[cid] = {
        nome: met.criativo.nome_anuncio || `Anúncio ${met.criativo.meta_ad_id}`,
        gasto: 0,
        leads: 0,
        impressoes: 0,
        cliques: 0
      };
    }
    criativosSum[cid].gasto += Number(met.valor_investido || 0);
    criativosSum[cid].leads += met.leads;
    criativosSum[cid].impressoes += met.impressoes;
    criativosSum[cid].cliques += met.cliques;
  }

  const listCriativos = Object.values(criativosSum).map(c => {
    c.cpa = c.leads > 0 ? (c.gasto / c.leads) : 0;
    c.ctr = c.impressoes > 0 ? (c.cliques / c.impressoes) * 100 : 0;
    return c;
  });

  // Ordenar por CPA (menor para maior) e excluir os que não geraram leads se houver os que geraram
  listCriativos.sort((a, b) => {
    if (a.leads === 0 && b.leads > 0) return 1;
    if (b.leads === 0 && a.leads > 0) return -1;
    return a.cpa - b.cpa;
  });

  console.log(`\n--- RANKING DE CRIATIVOS POR CPA ---`);
  listCriativos.slice(0, 10).forEach((c, index) => {
    console.log(`${index + 1}. ${c.nome}`);
    console.log(`  - Gasto: R$ ${c.gasto.toFixed(2)} | CTR: ${c.ctr.toFixed(2)}%`);
    console.log(`  - Leads: ${c.leads} | CPA: R$ ${c.cpa.toFixed(2)}`);
  });

}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
