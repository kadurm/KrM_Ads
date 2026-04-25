
async function investigate() {
  const ACCESS_TOKEN = 'EAAYYES5B9UgBRQaRlKc2t7qZB27kqokZBP1EKmFI6Hub7ZBNdZBGN3JoSP6dpZBQ0mufMKo71VZBgh93OdP0lalt1xZCXO8HHNc5avK3p0KhqzXgLv5cNLcXmVZBOZA72etylag2GJRYxZBxe9Sk96YYCGKi1I0wX1NDaEedl70vzyqdSO29B58bxX6rwsEnutt0PcnOa4QSnBYKaB';
  const AD_ACCOUNT_ID = '861875509414758';

  function graphUrl(path, query) {
    const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
    return url.toString();
  }

  try {
    const actId = `act_${AD_ACCOUNT_ID}`;
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    const since = sevenDaysAgo.toISOString().split('T')[0];
    const until = today.toISOString().split('T')[0];

    const insightUrl = graphUrl(`${actId}/insights`, {
      access_token: ACCESS_TOKEN,
      fields: 'ad_id,ad_name',
      level: 'ad',
      time_range: JSON.stringify({ since, until }),
      limit: '5'
    });

    const insightRes = await fetch(insightUrl);
    const insightData = await insightRes.json();
    const adIds = insightData.data ? insightData.data.map(i => i.ad_id) : [];

    if (adIds.length === 0) return console.log("Nenhum anúncio encontrado.");

    console.log(`[INVESTIGATION] Testando busca de criativos (CAMPOS SEGUROS) para IDs: ${adIds.slice(0,2).join(',')}...`);
    
    // Removendo campos que deram erro: thumbnail_url (ad level) e picture (creative level)
    const testUrl = graphUrl(``, { 
      ids: adIds.join(','), 
      fields: 'id,creative{id,image_url,thumbnail_url,image_hash,body,effective_object_story_id,video_id}', 
      access_token: ACCESS_TOKEN
    });

    const testRes = await fetch(testUrl);
    const testData = await testRes.json();

    if (testData.error) {
        console.log(`[FAIL] Erro:`, testData.error.message);
    } else {
        console.log(`[SUCCESS] Dados recuperados!`);
        Object.values(testData).forEach(ad => {
            console.log(`\nAD: ${ad.id}`);
            console.log(`CREATIVE:`, JSON.stringify(ad.creative, null, 2));
        });
    }

  } catch (err) {
    console.error(`[INVESTIGATION] Falha:`, err);
  }
}

investigate();
