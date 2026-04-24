
async function specificScan() {
  const token = 'EAAYYES5B9UgBRQaRlKc2t7qZB27kqokZBP1EKmFI6Hub7ZBNdZBGN3JoSP6dpZBQ0mufMKo71VZBgh93OdP0lalt1xZCXO8HHNc5avK3p0KhqzXgLv5cNLcXmVZBOZA72etylag2GJRYxZBxe9Sk96YYCGKi1I0wX1NDaEedl70vzyqdSO29B58bxX6rwsEnutt0PcnOa4QSnBYKaB';
  const id = 'act_861875509414758';
  
  // Pedindo especificamente as métricas de Instagram Follow
  const url = `https://graph.facebook.com/v21.0/${id}/insights?level=campaign&fields=campaign_name,actions,action_values&action_breakdowns=action_type&time_range={"since":"2026-04-23","until":"2026-04-23"}&access_token=${token}`;
  
  try {
    const r = await fetch(url);
    const j = await r.json();
    console.log(JSON.stringify(j, null, 2));
  } catch (e) { console.error(e); }
}
specificScan();
