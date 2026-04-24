
async function checkPattern() {
  const token = 'EAAYYES5B9UgBRQaRlKc2t7qZB27kqokZBP1EKmFI6Hub7ZBNdZBGN3JoSP6dpZBQ0mufMKo71VZBgh93OdP0lalt1xZCXO8HHNc5avK3p0KhqzXgLv5cNLcXmVZBOZA72etylag2GJRYxZBxe9Sk96YYCGKi1I0wX1NDaEedl70vzyqdSO29B58bxX6rwsEnutt0PcnOa4QSnBYKaB';
  const id = 'act_861875509414758';
  
  const periods = [
    { name: 'Fevereiro 2026', since: '2026-02-01', until: '2026-02-28' },
    { name: 'Março 2026', since: '2026-03-01', until: '2026-03-31' },
    { name: 'Abril 2026', since: '2026-04-01', until: '2026-04-24' }
  ];

  for (const p of periods) {
    console.log(`\n--- ANALISANDO: ${p.name} ---`);
    const url = `https://graph.facebook.com/v21.0/${id}/insights?fields=campaign_id,campaign_name,inline_link_clicks,actions&level=campaign&time_range={"since":"${p.since}","until":"${p.until}"}&access_token=${token}`;
    
    const r = await fetch(url).then(res => res.json());
    if (r.data) {
      const camp05 = r.data.find(c => c.campaign_name.includes('[05]'));
      if (camp05) {
        const inlineClicks = parseInt(camp05.inline_link_clicks || 0);
        const linkClicks = parseInt(camp05.actions?.find(a => a.action_type === 'link_click')?.value || 0);
        const profileVisits = parseInt(camp05.actions?.find(a => a.action_type === 'onsite_conversion.instagram_profile_visit')?.value || 0);
        
        console.log(`  Inline Link Clicks: ${inlineClicks}`);
        console.log(`  Link Clicks (Actions): ${linkClicks}`);
        console.log(`  Instagram Profile Visits (API): ${profileVisits}`);
        
        if (p.name === 'Março 2026') {
          console.log(`  Valor Real no Painel (User): 312`);
          console.log(`  Ratio (312 / ${inlineClicks}): ${(312/inlineClicks).toFixed(3)}`);
        } else {
          console.log(`  Projeção 80%: ${(inlineClicks * 0.8).toFixed(0)}`);
        }
      } else {
        console.log('  Campanha [05] não encontrada neste período.');
      }
    }
  }
}

checkPattern();
