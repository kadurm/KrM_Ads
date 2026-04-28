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

    // Dynamic parameter mapping for ANTIGRAVITY
    const processData = (fields) => {
      Object.entries(fields).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        
        // Special transformations
        if (key === 'daily_budget' || key === 'lifetime_budget') {
          params.append(key, String(Math.round(parseFloat(value) * 100)));
        } 
        else if (typeof value === 'object') {
          params.append(key, JSON.stringify(value));
        } 
        else {
          params.append(key, String(value));
        }
      });
    };

    if (type === 'campaign') {
      endpoint = `${creds.adAccountId}/campaigns`;
      params.append('special_ad_categories', '[]'); // Default if not provided
      processData(data);
    } 
    else if (type === 'adset') {
      endpoint = `${creds.adAccountId}/adsets`;
      // Ensure basic targeting if missing for ANTIGRAVITY flexibility
      if (!data.targeting) {
        data.targeting = { geo_locations: { countries: ['BR'] } };
      }
      processData(data);
    }
    else if (type === 'ad') {
      endpoint = `${creds.adAccountId}/ads`;
      processData(data);
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
