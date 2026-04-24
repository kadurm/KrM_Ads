
async function testAllActionTypes() {
  const token = 'EAAYYES5B9UgBRQaRlKc2t7qZB27kqokZBP1EKmFI6Hub7ZBNdZBGN3JoSP6dpZBQ0mufMKo71VZBgh93OdP0lalt1xZCXO8HHNc5avK3p0KhqzXgLv5cNLcXmVZBOZA72etylag2GJRYxZBxe9Sk96YYCGKi1I0wX1NDaEedl70vzyqdSO29B58bxX6rwsEnutt0PcnOa4QSnBYKaB';
  const id = 'act_861875509414758';
  const since = '2026-03-01';
  const until = '2026-03-31';
  
  // Vamos tentar níveis de AD para ver se a métrica aparece granularmente
  const url = `https://graph.facebook.com/v21.0/${id}/insights?fields=ad_id,ad_name,actions&level=ad&time_range={"since":"${since}","until":"${until}"}&access_token=${token}`;
  
  console.log(`Buscando dados por anúncio para o mês de março...`);
  const r = await fetch(url);
  const j = await r.json();
  
  if (j.data) {
    let totalLinkClicks = 0;
    let totalOtherPotential = 0;
    let foundValue = false;

    console.log('\n--- ANALISANDO ANÚNCIOS DA CAMPANHA [05] ---');
    
    // Filtrar apenas anúncios que podem pertencer à campanha [05] - meta_id 120237338823250488
    j.data.forEach(ad => {
       if (ad.actions) {
         ad.actions.forEach(a => {
           if (parseInt(a.value) === 312) {
             console.log(`🎯 ACHEI O VALOR 312 NO ANÚNCIO ${ad.ad_name}! Tipo: ${a.action_type}`);
             foundValue = true;
           }
         });
       }
    });

    if (!foundValue) {
      console.log('Não encontramos o valor exato 312 nos anúncios individuais.');
      // Vamos somar os tipos de ações de todos os anúncios para ver o total da conta
      const aggregate = {};
      j.data.forEach(ad => {
        if (ad.actions) {
          ad.actions.forEach(a => {
            aggregate[a.action_type] = (aggregate[a.action_type] || 0) + parseInt(a.value);
          });
        }
      });
      console.log('\nTotais Agregados da Conta no Período:');
      Object.entries(aggregate).forEach(([type, val]) => {
        if (val === 312) console.log(`🎯 ACHEI O TOTAL 312! Tipo: ${type}`);
        else console.log(`  - ${type}: ${val}`);
      });
    }
  }
}

testAllActionTypes();
