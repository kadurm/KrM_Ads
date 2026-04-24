import { NextResponse } from 'next/server';

function getClientCredentials(clienteName) {
  const shortName = clienteName.split(' ')[0];
  const rawAccountId = process.env[`META_AD_ACCOUNT_ID_${shortName}`];
  const accessToken = process.env[`META_ACCESS_TOKEN_${shortName}`];
  if (!rawAccountId || !accessToken) return null;
  const adAccountId = rawAccountId.startsWith('act_') ? rawAccountId : `act_${rawAccountId}`;
  return { adAccountId, accessToken };
}

/** POST — Cria objeto na Meta (Campaign, AdSet ou Ad) */
export async function POST(request) {
  try {
    const { cliente, type, data } = await request.json();
    if (!cliente || !type || !data) return NextResponse.json({ success: false, error: 'Dados incompletos' }, { status: 400 });

    const creds = getClientCredentials(cliente);
    if (!creds) return NextResponse.json({ success: false, error: `Credenciais não encontradas` }, { status: 500 });

    let endpoint = '';
    const params = new URLSearchParams({ access_token: creds.accessToken });

    if (type === 'campaign') {
      endpoint = `${creds.adAccountId}/campaigns`;
      params.append('name', data.name);
      params.append('objective', data.objective);
      params.append('status', data.status || 'PAUSED');
      params.append('special_ad_categories', '[]');
      if (data.daily_budget) params.append('daily_budget', String(Math.round(parseFloat(data.daily_budget) * 100)));
    } 
    else if (type === 'adset') {
      endpoint = `${creds.adAccountId}/adsets`;
      params.append('campaign_id', data.campaign_id);
      params.append('name', data.name);
      params.append('status', data.status || 'PAUSED');
      params.append('billing_event', data.billing_event || 'IMPRESSIONS');
      params.append('optimization_goal', data.optimization_goal || 'REACH');
      params.append('daily_budget', String(Math.round(parseFloat(data.daily_budget || 10) * 100)));
      // Targeting básico (Brasil) se não especificado
      params.append('targeting', JSON.stringify(data.targeting || { geo_locations: { countries: ['BR'] } }));
    }
    else if (type === 'ad') {
      endpoint = `${creds.adAccountId}/ads`;
      params.append('adset_id', data.adset_id);
      params.append('name', data.name);
      params.append('status', data.status || 'PAUSED');
      params.append('creative', JSON.stringify({ creative_id: data.creative_id }));
    }

    const res = await fetch(`https://graph.facebook.com/v21.0/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const result = await res.json();
    if (result.error) throw new Error(result.error.message);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Create Meta Object Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
