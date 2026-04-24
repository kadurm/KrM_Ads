
async function deepScan() {
  const token = 'EAAYYES5B9UgBRQaRlKc2t7qZB27kqokZBP1EKmFI6Hub7ZBNdZBGN3JoSP6dpZBQ0mufMKo71VZBgh93OdP0lalt1xZCXO8HHNc5avK3p0KhqzXgLv5cNLcXmVZBOZA72etylag2GJRYxZBxe9Sk96YYCGKi1I0wX1NDaEedl70vzyqdSO29B58bxX6rwsEnutt0PcnOa4QSnBYKaB';
  const accountId = 'act_861875509414758';
  const hoje = '2026-04-23';
  
  // Buscando no nível de ANÚNCIO (ad) que é mais detalhado que campanha
  const url = `https://graph.facebook.com/v21.0/${accountId}/insights?level=ad&fields=ad_name,campaign_name,actions,action_values&time_range={"since":"${hoje}","until":"${hoje}"}&access_token=${token}`;
  
  try {
    const r = await fetch(url);
    const j = await r.json();
    
    console.log('--- VARREDURA DETALHADA POR ANÚNCIO ---');
    if (j.data) {
      j.data.forEach(ad => {
        if (ad.campaign_name.includes('[05]')) {
          console.log(`\nANÚNCIO: ${ad.ad_name}`);
          if (ad.actions) {
            ad.actions.forEach(a => {
              // Procurando o valor 2 ou qualquer coisa relacionada a instagram/follow
              console.log(`  [Métrica] ${a.action_type}: ${a.value}`);
            });
          }
        }
      });
    } else {
      console.log('Erro:', j);
    }
  } catch (e) { console.error(e); }
}
deepScan();
