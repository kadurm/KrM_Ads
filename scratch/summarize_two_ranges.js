const fs = require('fs');
const path = require('path');

const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'solution_two_ranges.json'), 'utf-8')
);

let out = '';
function log(msg) {
  out += msg + '\n';
  console.log(msg);
}

log(`======================================================================`);
log(`SOLUTION PLACE - COMPARATIVO DOS ÚLTIMOS 30 DIAS`);
log(`======================================================================`);

[data.range1, data.range2].forEach((range, rIdx) => {
  log(`\n----------------------------------------------------------------------`);
  log(`FAIXA ${rIdx + 1}: Período ${range.dates}`);
  log(`----------------------------------------------------------------------`);
  log(`- Investimento Total: R$ ${range.totalSpend.toFixed(2)}`);
  log(`- Impressões Totais: ${range.totalImpressions}`);
  log(`- Cliques Totais: ${range.totalClicks}`);
  log(`- CTR Médio: ${(range.totalClicks / range.totalImpressions * 100).toFixed(2)}%`);
  log(`- CPC Médio: R$ ${(range.totalSpend / range.totalClicks).toFixed(2)}`);
  log(`- Leads (True Leads): ${range.totalLeads}`);
  log(`- CPL Médio: R$ ${(range.totalSpend / range.totalLeads).toFixed(2)}`);

  log(`\nDesempenho por Campanha:`);
  range.campaigns.sort((a, b) => b.spend - a.spend).forEach((c, cIdx) => {
    const cplStr = c.leads > 0 ? `R$ ${(c.spend / c.leads).toFixed(2)}` : 'N/A';
    log(`  ${cIdx + 1}. [${c.objective}] ${c.name}`);
    log(`     Spend: R$ ${c.spend.toFixed(2)} | Leads: ${c.leads} | CPL: ${cplStr} | Cliques: ${c.clicks}`);
  });
});

fs.writeFileSync(path.join(__dirname, 'solution_two_ranges_summary.txt'), out, 'utf-8');
