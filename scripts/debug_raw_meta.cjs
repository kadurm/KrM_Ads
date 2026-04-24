
async function debug() {
  const token = 'EAAYYES5B9UgBRQaRlKc2t7qZB27kqokZBP1EKmFI6Hub7ZBNdZBGN3JoSP6dpZBQ0mufMKo71VZBgh93OdP0lalt1xZCXO8HHNc5avK3p0KhqzXgLv5cNLcXmVZBOZA72etylag2GJRYxZBxe9Sk96YYCGKi1I0wX1NDaEedl70vzyqdSO29B58bxX6rwsEnutt0PcnOa4QSnBYKaB';
  const id = 'act_861875509414758';
  const hoje = '2026-04-23';
  
  const url = `https://graph.facebook.com/v21.0/${id}/insights?fields=campaign_id,campaign_name,actions&level=campaign&time_range={"since":"${hoje}","until":"${hoje}"}&access_token=${token}`;
  
  try {
    const r = await fetch(url);
    const j = await r.json();
    
    console.log('--- RESPOSTA BRUTA DA META ---');
    if (j.data) {
      j.data.forEach(camp => {
        console.log(`\nCAMPANHA: ${camp.campaign_name}`);
        if (camp.actions) {
          camp.actions.forEach(a => {
            console.log(`  - ${a.action_type}: ${a.value}`);
          });
        } else {
          console.log('  - Sem ações');
        }
      });
    } else {
      console.log(JSON.stringify(j, null, 2));
    }
  } catch (e) {
    console.error(e);
  }
}

debug();
