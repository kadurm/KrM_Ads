const fs = require('fs');
const path = require('path');

const ACCESS_TOKEN = "EAAYYES5B9UgBRQaRlKc2t7qZB27kqokZBP1EKmFI6Hub7ZBNdZBGN3JoSP6dpZBQ0mufMKo71VZBgh93OdP0lalt1xZCXO8HHNc5avK3p0KhqzXgLv5cNLcXmVZBOZA72etylag2GJRYxZBxe9Sk96YYCGKi1I0wX1NDaEedl70vzyqdSO29B58bxX6rwsEnutt0PcnOa4QSnBYKaB";
const AD_ACCOUNT_ID = 'act_861875509414758';

function graphUrl(path, query) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });
  return url.toString();
}

async function fetchMetaInsights(url) {
  let allData = [];
  let currentUrl = url;

  while (currentUrl) {
    const res = await fetch(currentUrl);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Meta API Error: ${err.error?.message || res.statusText}`);
    }
    const json = await res.json();
    if (json.data) allData = [...allData, ...json.data];
    currentUrl = json.paging?.next || null;
  }
  return allData;
}

function getMetric(actions, type) {
  if (!Array.isArray(actions)) return 0;
  const matches = actions.filter(a => a.action_type === type);
  if (matches.length === 0) return 0;
  return matches.reduce((acc, a) => acc + parseInt(a.value || 0, 10), 0);
}

function getTrueLeads(actions) {
  if (!Array.isArray(actions)) return 0;
  const msgReply = getMetric(actions, 'onsite_conversion.messaging_first_reply');
  const msgStarted = getMetric(actions, 'onsite_conversion.messaging_conversation_started_7d');
  const standardLead = getMetric(actions, 'lead');
  const leadGen = getMetric(actions, 'onsite_conversion.lead_grouped');
  const fbContact = getMetric(actions, 'contact');
  const customPixel = getMetric(actions, 'offsite_conversion.fb_pixel_custom');
  
  return Math.max(msgReply, msgStarted) + Math.max(standardLead, leadGen) + fbContact + customPixel;
}

async function getRangeData(since, until) {
  const time_range = { since, until };
  const commonQuery = { access_token: ACCESS_TOKEN, limit: '1000', time_range: JSON.stringify(time_range) };

  // 1. Campanhas
  const metaCampsRes = await fetch(graphUrl(`${AD_ACCOUNT_ID}/campaigns`, { access_token: ACCESS_TOKEN, fields: 'id,name,objective', limit: '1000' }));
  const metaCampsData = await metaCampsRes.json();
  const objectiveMap = new Map(metaCampsData.data?.map(c => [c.id, c.objective]) || []);

  // 2. Metrics de Campanha
  const campaignFields = 'campaign_id,campaign_name,spend,impressions,reach,clicks,inline_link_clicks,outbound_clicks,actions,action_values';
  const campaignData = await fetchMetaInsights(graphUrl(`${AD_ACCOUNT_ID}/insights`, { ...commonQuery, fields: campaignFields, level: 'campaign' }));

  // 3. Metrics de Criativos
  const adFields = 'ad_id,ad_name,campaign_id,spend,impressions,clicks,inline_link_clicks,actions';
  const adData = await fetchMetaInsights(graphUrl(`${AD_ACCOUNT_ID}/insights`, { ...commonQuery, fields: adFields, level: 'ad' }));

  // 4. Metadados
  const adsMetaRes = await fetch(graphUrl(`${AD_ACCOUNT_ID}/adcreatives`, { access_token: ACCESS_TOKEN, fields: 'id,body,image_url,thumbnail_url,image_hash,effective_object_story_id', thumbnail_width: 800, thumbnail_height: 800, limit: '1000' }));
  const adsMetaData = await adsMetaRes.json();
  const creativeMetaMap = new Map(adsMetaData.data?.map(m => [String(m.id), m]) || []);

  const storyIds = adsMetaData.data?.map(m => m.effective_object_story_id).filter(id => !!id) || [];
  const storyMetaMap = new Map();
  if (storyIds.length > 0) {
     for (let i = 0; i < storyIds.length; i += 50) {
       const chunk = storyIds.slice(i, i + 50);
       const res = await fetch(graphUrl(``, { ids: chunk.join(','), fields: 'id,full_picture', access_token: ACCESS_TOKEN }));
       const data = await res.json();
       Object.values(data).forEach(post => {
         if (post.full_picture) storyMetaMap.set(post.id, post.full_picture);
       });
     }
  }

  const imageHashMap = new Map();
  const uniqueHashes = [...new Set(adsMetaData.data?.map(m => m.image_hash).filter(h => !!h) || [])];
  if (uniqueHashes.length > 0) {
     for (let i = 0; i < uniqueHashes.length; i += 50) {
       const chunk = uniqueHashes.slice(i, i + 50);
       const res = await fetch(graphUrl(`${AD_ACCOUNT_ID}/adimages`, { access_token: ACCESS_TOKEN, hashes: JSON.stringify(chunk), fields: 'url,permalink_url,hash' }));
       const data = await res.json();
       if (data.data) data.data.forEach(img => {
         const bestUrl = img.url || img.permalink_url;
         if (bestUrl) imageHashMap.set(img.hash, bestUrl);
       });
     }
  }

  const adsListRes = await fetch(graphUrl(`${AD_ACCOUNT_ID}/ads`, { access_token: ACCESS_TOKEN, fields: 'id,creative{id}', limit: '1000' }));
  const adsListData = await adsListRes.json();
  const adToCreativeMap = new Map(adsListData.data?.map(a => [a.id, a.creative?.id]) || []);

  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalLeads = 0;

  campaignData.forEach(c => {
    totalSpend += parseFloat(c.spend || 0);
    totalImpressions += parseInt(c.impressions || 0);
    totalClicks += parseInt(c.clicks || 0);
    totalLeads += getTrueLeads(c.actions);
  });

  const campaigns = campaignData.map(camp => {
    const spend = parseFloat(camp.spend || 0);
    const impressions = parseInt(camp.impressions || 0);
    const clicks = parseInt(camp.clicks || 0);
    const leads = getTrueLeads(camp.actions);
    const objective = objectiveMap.get(camp.campaign_id) || 'UNKNOWN';

    // Criativos
    const campAds = adData.filter(ad => ad.campaign_id === camp.campaign_id).map(ad => {
      const adSpend = parseFloat(ad.spend || 0);
      const adImpressions = parseInt(ad.impressions || 0);
      const adClicks = parseInt(ad.clicks || 0);
      const adLeads = getTrueLeads(ad.actions);

      const creativeId = adToCreativeMap.get(ad.ad_id);
      const adMeta = creativeMetaMap.get(String(creativeId)) || {};
      
      const highResImage = imageHashMap.get(adMeta.image_hash) 
                        || storyMetaMap.get(adMeta.effective_object_story_id) 
                        || adMeta.image_url 
                        || adMeta.thumbnail_url;

      return {
        name: ad.ad_name,
        ad_id: ad.ad_id,
        spend: adSpend,
        impressions: adImpressions,
        clicks: adClicks,
        leads: adLeads,
        url_midia: highResImage,
        body: adMeta.body
      };
    });

    return {
      name: camp.campaign_name,
      campaign_id: camp.campaign_id,
      spend,
      impressions,
      clicks,
      leads,
      objective,
      ads: campAds
    };
  });

  return {
    totalSpend,
    totalImpressions,
    totalClicks,
    totalLeads,
    campaigns
  };
}

async function main() {
  console.log("Consultando faixa 1 (05/05 a 03/06)...");
  const data1 = await getRangeData('2026-05-05', '2026-06-03');

  console.log("Consultando faixa 2 (06/05 a 04/06)...");
  const data2 = await getRangeData('2026-05-06', '2026-06-04');

  const result = {
    range1: {
      dates: '05/05/2026 a 03/06/2026',
      ...data1
    },
    range2: {
      dates: '06/05/2026 a 04/06/2026',
      ...data2
    }
  };

  fs.writeFileSync(
    path.join(__dirname, 'solution_two_ranges.json'),
    JSON.stringify(result, null, 2),
    'utf-8'
  );
  console.log("Dados salvos em: solution_two_ranges.json");
}

main().catch(err => console.error(err));
