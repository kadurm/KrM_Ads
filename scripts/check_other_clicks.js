
async function checkOtherClicks() {
  const token = 'EAAYYES5B9UgBRQaRlKc2t7qZB27kqokZBP1EKmFI6Hub7ZBNdZBGN3JoSP6dpZBQ0mufMKo71VZBgh93OdP0lalt1xZCXO8HHNc5avK3p0KhqzXgLv5cNLcXmVZBOZA72etylag2GJRYxZBxe9Sk96YYCGKi1I0wX1NDaEedl70vzyqdSO29B58bxX6rwsEnutt0PcnOa4QSnBYKaB';
  const id = 'act_861875509414758';
  const since = '2026-03-01';
  const until = '2026-03-31';
  
  const url = `https://graph.facebook.com/v21.0/${id}/insights?fields=campaign_id,campaign_name,inline_link_clicks,unique_inline_link_clicks,clicks,unique_clicks&level=campaign&time_range={"since":"${since}","until":"${until}"}&access_token=${token}`;
  
  const r = await fetch(url);
  const j = await r.json();
  if (j.error) console.error(j.error);
  if (j.data) {
    const camp05 = j.data.find(c => c.campaign_name.includes('[05]'));
    if (camp05) {
      console.log(`\n✅ CAMPANHA ENCONTRADA: ${camp05.campaign_name}`);
      console.log(`Clicks (Total): ${camp05.clicks}`);
      console.log(`Unique Clicks: ${camp05.unique_clicks}`);
      console.log(`Inline Link Clicks: ${camp05.inline_link_clicks}`);
      console.log(`Unique Inline Link Clicks: ${camp05.unique_inline_link_clicks}`);
    }
  }
}
checkOtherClicks();
