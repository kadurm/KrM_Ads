const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

async function main() {
  const slug = 'solutionplace';
  const cliente = await prisma.cliente.findUnique({
    where: { slug },
    include: {
      campanhas: {
        include: {
          metricas: {
            orderBy: { data: 'asc' }
          },
          criativos: {
            include: {
              metricas: true
            }
          }
        }
      }
    }
  });

  if (!cliente) {
    console.error(`Cliente com slug ${slug} não encontrado.`);
    return;
  }

  let out = '';
  function log(msg) {
    out += msg + '\n';
  }

  log(`======================================================================`);
  log(`ANALISANDO DADOS SINCRONIZADOS DA SOLUTION PLACE`);
  log(`Período analisado: Últimos 30 dias (de 2026-05-06 a 2026-06-05)`);
  log(`======================================================================`);

  const campanhasComMetricas = cliente.campanhas.map(camp => {
    let spend = 0;
    let impressions = 0;
    let clicks = 0;
    let leads = 0;
    let profileVisits = 0;
    let purchases = 0;
    let purchaseVal = 0;

    camp.metricas.forEach(m => {
      spend += Number(m.valor_investido || 0);
      impressions += m.impressoes || 0;
      clicks += m.cliques || 0;
      leads += m.conversas_leads || 0;
      profileVisits += m.visitas_perfil || 0;
      purchases += m.compras || 0;
      purchaseVal += Number(m.valor_compras || 0);
    });

    return {
      id: camp.id,
      meta_id: camp.meta_id,
      nome: camp.nome_gerado,
      objetivo: camp.objetivo,
      spend,
      impressions,
      clicks,
      leads,
      profileVisits,
      purchases,
      purchaseVal,
      metricasRaw: camp.metricas,
      criativos: camp.criativos
    };
  }).filter(c => c.spend > 0 || c.clicks > 0 || c.impressions > 0);

  log(`Total de campanhas ativas/com métricas no período: ${campanhasComMetricas.length}`);
  
  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalLeads = 0;
  let totalVisits = 0;
  
  campanhasComMetricas.forEach(c => {
    totalSpend += c.spend;
    totalImpressions += c.impressions;
    totalClicks += c.clicks;
    totalLeads += c.leads;
    totalVisits += c.profileVisits;
  });

  log(`\n--- RESUMO CONSOLIDADO DA CONTA ---`);
  log(`Total Investido: R$ ${totalSpend.toFixed(2)}`);
  log(`Total Impressões: ${totalImpressions}`);
  log(`Total Cliques: ${totalClicks}`);
  log(`CTR Médio da Conta: ${totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) + '%' : '0%'}`);
  log(`CPC Médio da Conta: ${totalClicks > 0 ? 'R$ ' + (totalSpend / totalClicks).toFixed(2) : 'N/A'}`);
  log(`Total Leads (Conversas Iniciadas/True Leads): ${totalLeads}`);
  log(`CPL Médio da Conta (Leads de Conversa): ${totalLeads > 0 ? 'R$ ' + (totalSpend / totalLeads).toFixed(2) : 'N/A'}`);
  log(`Total Visitas Perfil (Atribuição Universal): ${totalVisits}`);

  log(`\n--- PERFORMANCE POR CAMPANHA ---`);
  campanhasComMetricas.sort((a, b) => b.spend - a.spend).forEach((camp, index) => {
    const ctr = camp.impressions > 0 ? ((camp.clicks / camp.impressions) * 100).toFixed(2) + '%' : '0%';
    const cpl = camp.leads > 0 ? 'R$ ' + (camp.spend / camp.leads).toFixed(2) : 'N/A';
    const cpc = camp.clicks > 0 ? 'R$ ' + (camp.spend / camp.clicks).toFixed(2) : 'N/A';
    
    log(`\n${index + 1}. [${camp.objetivo}] ${camp.nome}`);
    log(`   Meta ID: ${camp.meta_id}`);
    log(`   Investido: R$ ${camp.spend.toFixed(2)}`);
    log(`   Impressões: ${camp.impressions} | Cliques: ${camp.clicks} | CTR: ${ctr}`);
    log(`   Leads: ${camp.leads} | CPL: ${cpl} | CPC: ${cpc}`);
    log(`   Visitas Perfil/Cliques Outbound: ${camp.profileVisits}`);

    log(`   Criativos desta campanha com dados de performance:`);
    const criativosMetricas = camp.criativos.map(cr => {
      let cSpend = 0;
      let cImpressions = 0;
      let cClicks = 0;
      let cLeads = 0;

      cr.metricas.forEach(cm => {
        cSpend += Number(cm.valor_investido || 0);
        cImpressions += cm.impressoes || 0;
        cClicks += cm.cliques || 0;
        cLeads += cm.leads || 0;
      });

      return {
        id: cr.id,
        ad_id: cr.meta_ad_id,
        nome: cr.nome_anuncio,
        spend: cSpend,
        impressions: cImpressions,
        clicks: cClicks,
        leads: cLeads,
        url_midia: cr.url_midia,
        body: cr.texto_principal
      };
    }).filter(cr => cr.spend > 0 || cr.clicks > 0 || cr.impressions > 0);

    criativosMetricas.sort((a, b) => b.spend - a.spend).forEach(cr => {
      const cCtr = cr.impressions > 0 ? ((cr.clicks / cr.impressions) * 100).toFixed(2) + '%' : '0%';
      const cCpl = cr.leads > 0 ? 'R$ ' + (cr.spend / cr.leads).toFixed(2) : 'N/A';
      log(`     * Anúncio: ${cr.nome} (Meta ID: ${cr.ad_id})`);
      log(`       - Investimento: R$ ${cr.spend.toFixed(2)} | Cliques: ${cr.clicks} | Leads: ${cr.leads} | CPL: ${cCpl} | CTR: ${cCtr}`);
      if (cr.body) {
        log(`       - Copy: "${cr.body.substring(0, 120).replace(/\n/g, ' ')}..."`);
      }
    });
  });

  log(`\n======================================================================`);
  log(`RANKING GERAL DE CRIATIVOS POR NÚMERO DE LEADS`);
  log(`======================================================================`);
  
  const todosCriativos = [];
  campanhasComMetricas.forEach(camp => {
    camp.criativos.forEach(cr => {
      let cSpend = 0;
      let cImpressions = 0;
      let cClicks = 0;
      let cLeads = 0;

      cr.metricas.forEach(cm => {
        cSpend += Number(cm.valor_investido || 0);
        cImpressions += cm.impressoes || 0;
        cClicks += cm.cliques || 0;
        cLeads += cm.leads || 0;
      });

      if (cSpend > 0 || cImpressions > 0 || cClicks > 0 || cLeads > 0) {
        todosCriativos.push({
          nome: cr.nome_anuncio,
          ad_id: cr.meta_ad_id,
          campanha: camp.nome,
          spend: cSpend,
          impressions: cImpressions,
          clicks: cClicks,
          leads: cLeads,
          url_midia: cr.url_midia,
          body: cr.texto_principal
        });
      }
    });
  });

  todosCriativos.sort((a, b) => b.leads - a.leads || b.spend - a.spend);
  todosCriativos.slice(0, 15).forEach((cr, index) => {
    const cCtr = cr.impressions > 0 ? ((cr.clicks / cr.impressions) * 100).toFixed(2) + '%' : '0%';
    const cCpl = cr.leads > 0 ? 'R$ ' + (cr.spend / cr.leads).toFixed(2) : 'N/A';
    log(`${index + 1}. ${cr.nome} [Campanha: ${cr.campanha}]`);
    log(`   Meta ID: ${cr.ad_id}`);
    log(`   Performance: Leads: ${cr.leads} | Investido: R$ ${cr.spend.toFixed(2)} | CPL: ${cCpl} | CTR: ${cCtr} | Cliques: ${cr.clicks}`);
    if (cr.url_midia) {
      log(`   URL Mídia: ${cr.url_midia}`);
    }
    if (cr.body) {
      log(`   Copy: "${cr.body.substring(0, 150).replace(/\n/g, ' ')}..."`);
    }
    log('');
  });

  const outputPath = path.join(__dirname, 'solution_analysis_full.txt');
  fs.writeFileSync(outputPath, out, 'utf-8');
  console.log(`Análise escrita em: ${outputPath}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
