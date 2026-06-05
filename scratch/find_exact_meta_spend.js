const ACCESS_TOKEN = "EAAYYES5B9UgBRQaRlKc2t7qZB27kqokZBP1EKmFI6Hub7ZBNdZBGN3JoSP6dpZBQ0mufMKo71VZBgh93OdP0lalt1xZCXO8HHNc5avK3p0KhqzXgLv5cNLcXmVZBOZA72etylag2GJRYxZBxe9Sk96YYCGKi1I0wX1NDaEedl70vzyqdSO29B58bxX6rwsEnutt0PcnOa4QSnBYKaB";
const AD_ACCOUNT_ID = 'act_861875509414758';

async function testRange(since, until) {
  const time_range = { since, until };
  const url = `https://graph.facebook.com/v21.0/${AD_ACCOUNT_ID}/insights?level=account&time_range=${encodeURIComponent(JSON.stringify(time_range))}&fields=spend,impressions,clicks,actions&access_token=${ACCESS_TOKEN}`;
  
  try {
    const res = await fetch(url);
    const json = await res.json();
    if (json.data && json.data.length > 0) {
      const spend = parseFloat(json.data[0].spend || 0);
      return spend;
    }
  } catch (e) {}
  return 0;
}

async function main() {
  const target = 4907.51;
  console.log(`Buscando janela de data com gasto próximo ou igual a R$ ${target}...`);
  
  // Vamos varrer um espaço de busca em torno de maio e junho de 2026
  const baseEnd = new Date('2026-06-05');
  
  for (let endOffset = 0; endOffset < 6; endOffset++) {
    const untilDate = new Date(baseEnd);
    untilDate.setDate(untilDate.getDate() - endOffset);
    const until = untilDate.toISOString().split('T')[0];
    
    for (let length = 28; length <= 32; length++) {
      const sinceDate = new Date(untilDate);
      sinceDate.setDate(sinceDate.getDate() - (length - 1));
      const since = sinceDate.toISOString().split('T')[0];
      
      const spend = await testRange(since, until);
      const diff = Math.abs(spend - target);
      if (diff < 20 || spend === target) {
        console.log(`- Janela: ${since} até ${until} (${length} dias) -> Gasto: R$ ${spend.toFixed(2)} | Dif: R$ ${diff.toFixed(2)}`);
      }
    }
  }
}

main();
