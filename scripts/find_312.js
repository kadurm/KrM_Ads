
async function findExact312() {
  const token = 'EAAYYES5B9UgBRQaRlKc2t7qZB27kqokZBP1EKmFI6Hub7ZBNdZBGN3JoSP6dpZBQ0mufMKo71VZBgh93OdP0lalt1xZCXO8HHNc5avK3p0KhqzXgLv5cNLcXmVZBOZA72etylag2GJRYxZBxe9Sk96YYCGKi1I0wX1NDaEedl70vzyqdSO29B58bxX6rwsEnutt0PcnOa4QSnBYKaB';
  const id = 'act_861875509414758';
  const since = '2026-03-01';
  const until = '2026-03-31';
  
  // Vamos pedir o breakdown de plataforma junto com inline_link_clicks
  const url = `https://graph.facebook.com/v21.0/${id}/insights?fields=campaign_id,campaign_name,inline_link_clicks,actions&level=campaign&breakdowns=publisher_platform&time_range={"since":"${since}","until":"${until}"}&access_token=${token}`;
  
  const r = await fetch(url);
  const j = await r.json();
  if (j.error) console.error(j.error);
  
  if (j.data) {
    const camp05 = j.data.filter(c => c.campaign_name.includes('[05]'));
    console.log(`\n📊 ANÁLISE CAMPANHA [05] (MARÇO):`);
    
    let totalIGInline = 0;
    camp05.forEach(c => {
      console.log(`Plataforma: ${c.publisher_platform} | Inline Link Clicks: ${c.inline_link_clicks}`);
      if (c.publisher_platform === 'instagram') totalIGInline = parseInt(c.inline_link_clicks);
    });

    console.log(`\nVALOR ENCONTRADO NO INSTAGRAM: ${totalIGInline}`);
    
    if (totalIGInline === 312) {
       console.log('🎯 ENCONTREI! O valor de 312 é exatamente o INLINE LINK CLICKS do INSTAGRAM.');
    } else {
       console.log(`Ainda não é 312. O valor do IG é ${totalIGInline}.`);
       
       // Última tentativa: Unique Inline Link Clicks no Instagram
       const urlUnique = `https://graph.facebook.com/v21.0/${id}/insights?fields=campaign_id,campaign_name,unique_inline_link_clicks&level=campaign&breakdowns=publisher_platform&time_range={"since":"${since}","until":"${until}"}&access_token=${token}`;
       const rU = await fetch(urlUnique).then(res => res.json());
       const camp05U = rU.data.filter(c => c.campaign_name.includes('[05]'));
       
       camp05U.forEach(c => {
         if (c.publisher_platform === 'instagram') {
           console.log(`Unique Inline Link Clicks (IG): ${c.unique_inline_link_clicks}`);
           if (parseInt(c.unique_inline_link_clicks) === 312) console.log('🎯 ACHEI! É o UNIQUE INLINE LINK CLICKS do INSTAGRAM.');
         }
       });
    }
  }
}

findExact312();
