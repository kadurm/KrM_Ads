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

function parseActions(actions) {
  if (!actions || !Array.isArray(actions)) return 0;
  // Foca em conversas e leads como métrica principal de 'resultado'
  const messaging = actions.find(a => a.action_type === 'onsite_conversion.messaging_conversation_started_7d');
  const leads = actions.find(a => a.action_type === 'lead');
  return (parseInt(messaging?.value || 0)) + (parseInt(leads?.value || 0));
}

/** GET — Lista objetos (Campanhas, Conjuntos ou Anúncios) com métricas */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const cliente = searchParams.get('cliente');
    const level = searchParams.get('level') || 'campaign'; // campaign, adset, ad
    const parentId = searchParams.get('parentId');
    const since = searchParams.get('since');
    const until = searchParams.get('until');

    if (!cliente) return NextResponse.json({ success: false, error: 'Cliente não especificado' }, { status: 400 });

    const creds = getClientCredentials(cliente);
    if (!creds) return NextResponse.json({ success: false, error: `Credenciais não encontradas para ${cliente}` }, { status: 500 });

    let endpoint = `${creds.adAccountId}/campaigns`;
    let fields = 'id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,updated_time';

    if (level === 'adset') {
      endpoint = parentId ? `${parentId}/adsets` : `${creds.adAccountId}/adsets`;
      fields = 'id,name,status,effective_status,daily_budget,lifetime_budget,billing_event,bid_amount,campaign_id';
    } else if (level === 'ad') {
      endpoint = parentId ? `${parentId}/ads` : `${creds.adAccountId}/ads`;
      fields = 'id,name,status,effective_status,adset_id,campaign_id,creative{id,name,image_url,thumbnail_url}';
    }

    // Adiciona insights aos campos
    const insightsFields = 'spend,impressions,clicks,inline_link_clicks,actions,inline_link_click_ctr';
    
    // Busca os objetos principais
    const res = await fetch(graphUrl(endpoint, {
      access_token: creds.accessToken,
      fields: `${fields},insights.level(${level})${since && until ? `.time_range({"since":"${since}","until":"${until}"})` : ''}{${insightsFields}}`,
      limit: '100',
    }));
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    const items = (data.data || []).map(item => {
      const insights = item.insights?.data?.[0] || {};
      return {
        id: item.id,
        name: item.name,
        status: item.status,
        effective_status: item.effective_status,
        objective: item.objective,
        daily_budget: item.daily_budget ? (parseInt(item.daily_budget) / 100).toFixed(2) : null,
        lifetime_budget: item.lifetime_budget ? (parseInt(item.lifetime_budget) / 100).toFixed(2) : null,
        
        // Métricas
        spend: parseFloat(insights.spend || 0).toFixed(2),
        impressions: parseInt(insights.impressions || 0),
        clicks: parseInt(insights.clicks || 0),
        ctr: parseFloat(insights.inline_link_click_ctr || 0).toFixed(2),
        results: parseActions(insights.actions),
        
        // Relacionamentos
        campaign_id: item.campaign_id,
        adset_id: item.adset_id,
        creative: item.creative
      };
    });

    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error('GET Meta Objects Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** PATCH — Atualiza status, nome ou orçamento em qualquer nível */
export async function PATCH(request) {
  try {
    const { cliente, id, status, name, daily_budget } = await request.json();
    if (!cliente || !id) return NextResponse.json({ success: false, error: 'cliente e id são obrigatórios' }, { status: 400 });

    const creds = getClientCredentials(cliente);
    if (!creds) return NextResponse.json({ success: false, error: `Credenciais não encontradas para ${cliente}` }, { status: 500 });

    const updateFields = {};
    if (status) updateFields.status = status;
    if (name) updateFields.name = name;
    if (daily_budget) updateFields.daily_budget = Math.round(parseFloat(daily_budget) * 100);

    const params = new URLSearchParams({ access_token: creds.accessToken });
    Object.entries(updateFields).forEach(([k, v]) => params.append(k, String(v)));

    const res = await fetch(`https://graph.facebook.com/v21.0/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    return NextResponse.json({ success: true, result: data });
  } catch (error) {
    console.error('PATCH Meta Object Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** POST — Cria nova campanha (mantido conforme original) */
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
