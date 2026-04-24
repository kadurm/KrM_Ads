
async function finalAttempt() {
  const token = 'EAAYYES5B9UgBRQaRlKc2t7qZB27kqokZBP1EKmFI6Hub7ZBNdZBGN3JoSP6dpZBQ0mufMKo71VZBgh93OdP0lalt1xZCXO8HHNc5avK3p0KhqzXgLv5cNLcXmVZBOZA72etylag2GJRYxZBxe9Sk96YYCGKi1I0wX1NDaEedl70vzyqdSO29B58bxX6rwsEnutt0PcnOa4QSnBYKaB';
  const id = 'act_861875509414758';
  const since = '2026-03-01';
  const until = '2026-03-31';
  
  console.log(`🔍 BUSCA EXAUSTIVA PELO VALOR 312 (MARÇO/2026)`);

  // 1. Tentar todas as ações com breakdown de plataforma e dispositivo
  const url1 = `https://graph.facebook.com/v21.0/${id}/insights?fields=campaign_id,campaign_name,actions,action_values,inline_link_clicks,unique_inline_link_clicks&level=campaign&breakdowns=publisher_platform&time_range={"since":"${since}","until":"${until}"}&access_token=${token}`;
  
  // 2. Tentar campos de visualização de conteúdo (que às vezes mapeiam visitas)
  const url2 = `https://graph.facebook.com/v21.0/${id}/insights?fields=campaign_id,campaign_name,actions&level=campaign&action_breakdowns=action_type&time_range={"since":"${since}","until":"${until}"}&access_token=${token}`;

  const [res1, res2] = await Promise.all([fetch(url1).then(r => r.json()), fetch(url2).then(r => r.json())]);

  console.log('\n--- ANALISANDO RESULTADOS ---');

  if (res1.data) {
    const camp05 = res1.data.filter(c => c.campaign_name.includes('[05]'));
    console.log(`\nCampanha [05] por Plataforma:`);
    camp05.forEach(c => {
      console.log(`  Plataforma: ${c.publisher_platform}`);
      console.log(`  Inline Link Clicks: ${c.inline_link_clicks}`);
      if (c.actions) {
        c.actions.forEach(a => {
           if (parseInt(a.value) === 312) console.log(`🎯 ACHEI NA PLATAFORMA ${c.publisher_platform}! ${a.action_type}: ${a.value}`);
           else console.log(`    - ${a.action_type}: ${a.value}`);
        });
      }
    });
  }

  if (res2.data) {
    const camp05 = res2.data.filter(c => c.campaign_name.includes('[05]'));
    console.log(`\nCampanha [05] - Todas as Ações (March):`);
    const allActions = {};
    camp05.forEach(c => {
       if (c.actions) {
         c.actions.forEach(a => {
           allActions[a.action_type] = (allActions[a.action_type] || 0) + parseInt(a.value);
         });
       }
    });

    Object.entries(allActions).forEach(([type, val]) => {
      if (val === 312) console.log(`🎯 ACHEI O TOTAL 312! Tipo: ${type}`);
      else console.log(`  - ${type}: ${val}`);
    });
    
    // Verificação de soma de engajamentos específicos
    const postReactions = allActions['post_reaction'] || 0;
    const postLikes = allActions['onsite_conversion.post_net_like'] || 0;
    console.log(`\nDiferença Post Reaction vs Likes: ${postReactions - postLikes}`);
  }
}

finalAttempt();
