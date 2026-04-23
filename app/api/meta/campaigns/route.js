import { NextResponse } from 'next/server';

function graphUrl(path, query) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });
  return url.toString();
}

function getClientCredentials(clienteName) {
  const shortName = clienteName.split(' ')[0];
  const rawAccountId = process.env[`META_AD_ACCOUNT_ID_${shortName}`];
  const accessToken = process.env[`META_ACCESS_TOKEN_${shortName}`];
  if (!rawAccountId || !accessToken) return null;
  const adAccountId = rawAccountId.startsWith('act_') ? rawAccountId : `act_${rawAccountId}`;
  return { adAccountId, accessToken };
}

/** GET — Lista campanhas com status, orçamento e objetivo */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const cliente = searchParams.get('cliente');
    if (!cliente) return NextResponse.json({ success: false, error: 'Cliente não especificado' }, { status: 400 });

    const creds = getClientCredentials(cliente);
    if (!creds) return NextResponse.json({ success: false, error: `Credenciais não encontradas para ${cliente}` }, { status: 500 });

    const res = await fetch(graphUrl(`${creds.adAccountId}/campaigns`, {
      access_token: creds.accessToken,
      fields: 'id,name,status,objective,daily_budget,lifetime_budget,start_time,updated_time',
      limit: '100',
    }));
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    const campaigns = (data.data || []).map(c => ({
      id: c.id,
      name: c.name,
      status: c.status,
      objective: c.objective,
      daily_budget: c.daily_budget ? (parseInt(c.daily_budget) / 100).toFixed(2) : null,
      lifetime_budget: c.lifetime_budget ? (parseInt(c.lifetime_budget) / 100).toFixed(2) : null,
      start_time: c.start_time,
      updated_time: c.updated_time,
    }));

    return NextResponse.json({ success: true, campaigns });
  } catch (error) {
    console.error('GET Campaigns Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** PATCH — Atualiza status (ACTIVE/PAUSED), nome ou orçamento */
export async function PATCH(request) {
  try {
    const { cliente, campaignId, status, name, daily_budget } = await request.json();
    if (!cliente || !campaignId) return NextResponse.json({ success: false, error: 'cliente e campaignId são obrigatórios' }, { status: 400 });

    const creds = getClientCredentials(cliente);
    if (!creds) return NextResponse.json({ success: false, error: `Credenciais não encontradas para ${cliente}` }, { status: 500 });

    const updateFields = {};
    if (status) updateFields.status = status;
    if (name) updateFields.name = name;
    if (daily_budget) updateFields.daily_budget = Math.round(parseFloat(daily_budget) * 100);

    const params = new URLSearchParams({ access_token: creds.accessToken });
    Object.entries(updateFields).forEach(([k, v]) => params.append(k, String(v)));

    const res = await fetch(`https://graph.facebook.com/v21.0/${campaignId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    return NextResponse.json({ success: true, result: data });
  } catch (error) {
    console.error('PATCH Campaign Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** POST — Cria nova campanha */
export async function POST(request) {
  try {
    const { cliente, name, objective, daily_budget, status } = await request.json();
    if (!cliente || !name || !objective) return NextResponse.json({ success: false, error: 'cliente, name e objective são obrigatórios' }, { status: 400 });

    const creds = getClientCredentials(cliente);
    if (!creds) return NextResponse.json({ success: false, error: `Credenciais não encontradas para ${cliente}` }, { status: 500 });

    const params = new URLSearchParams({
      access_token: creds.accessToken,
      name,
      objective,
      status: status || 'PAUSED',
      special_ad_categories: '[]',
    });
    if (daily_budget) params.append('daily_budget', String(Math.round(parseFloat(daily_budget) * 100)));

    const res = await fetch(`https://graph.facebook.com/v21.0/${creds.adAccountId}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    return NextResponse.json({ success: true, campaign: data });
  } catch (error) {
    console.error('POST Campaign Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
