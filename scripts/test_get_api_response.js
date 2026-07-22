const fs = require('fs');
const path = require('path');

async function main() {
  const url = 'http://localhost:3000/api/meta/sync?cliente=Direito%20Direto&since=2026-05-01&until=2026-05-31';
  const res = await fetch(url);
  const data = await res.json();
  
  console.log('=== GET API METRICS RESPONSE ===');
  if (data.metrics) {
    data.metrics.forEach(m => {
      console.log(`Campanha: ${m.campanha?.nome_gerado}`);
      console.log(`- Objetivo Label: ${m.objetivo}`);
      console.log(`- Resultado Bruto: ${m.resultadoBruto}`);
      console.log(`- Cliques: ${m.cliques}`);
      console.log(`- Visitas Perfil: ${m.visitas_perfil}`);
      console.log(`- Valor Investido: ${m.valor_investido}`);
    });
  } else {
    console.dir(data, { depth: null });
  }
}

main().catch(console.error);
