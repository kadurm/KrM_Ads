
async function debug() {
  const token = 'EAAYYES5B9UgBRQaRlKc2t7qZB27kqokZBP1EKmFI6Hub7ZBNdZBGN3JoSP6dpZBQ0mufMKo71VZBgh93OdP0lalt1xZCXO8HHNc5avK3p0KhqzXgLv5cNLcXmVZBOZA72etylag2GJRYxZBxe9Sk96YYCGKi1I0wX1NDaEedl70vzyqdSO29B58bxX6rwsEnutt0PcnOa4QSnBYKaB';
  const id = 'act_861875509414758';
  
  const url = `https://graph.facebook.com/v21.0/${id}/insights?fields=actions&level=account&date_preset=last_90d&access_token=${token}`;
  
  try {
    const r = await fetch(url);
    const j = await r.json();
    
    console.log('--- BUSCA HISTÓRICA (90 DIAS) ---');
    if (j.data && j.data[0] && j.data[0].actions) {
      j.data[0].actions.forEach(a => {
        if (a.action_type.includes('follow') || a.action_type.includes('page_like')) {
           console.log(`Métrica encontrada: ${a.action_type} - Total: ${a.value}`);
        }
      });
    } else {
      console.log('Nenhuma métrica de seguidor encontrada nos últimos 90 dias.');
    }
  } catch (e) { console.error(e); }
}

debug();
