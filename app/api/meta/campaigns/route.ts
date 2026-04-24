import { NextResponse } from 'next/server';
import { MetaCampaign } from '@/types/meta-campaigns';

function graphUrl(path: string, query: Record<string, any>) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });
  return url.toString();
}

function getClientCredentials(clienteName: string) {
  const shortName = clienteName.split(' ')[0];
  const rawAccountId = process.env[`META_AD_ACCOUNT_ID_${shortName}`];
  const accessToken = process.env[`META_ACCESS_TOKEN_${shortName}`];
  if (!rawAccountId || !accessToken) return null;
  const adAccountId = rawAccountId.startsWith('act_') ? rawAccountId : `act_${rawAccountId}`;
  return { adAccountId, accessToken };
}

function parseActions(actions: any[]) {
  if (!actions || !Array.isArray(actions)) return 0;
  const messaging = actions.find(a => a.action_type === 'onsite_conversion.messaging_conversation_started_7d');
  const leads = actions.find(a => a.action_type === 'lead');
  return (parseInt(messaging?.value || 0)) + (parseInt(leads?.value || 0));
}

/** GET — Lista objetos com métricas Andromeda 2026 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cliente = searchParams.get('cliente');
    const level = searchParams.get('level') || 'campaign'; 
    const parentId = searchParams.get('parentId');
    const since = searchParams.get('since');
    const until = searchParams.get('until');

    if (!cliente) return NextResponse.json({ success: false, error: 'Cliente não especificado' }, { status: 400 });

    const creds = getClientCredentials(cliente);
    if (!creds) return NextResponse.json({ success: false, error: `Credenciais não encontradas para ${cliente}` }, { status: 500 });

    let endpoint = `${creds.adAccountId}/campaigns`;
    // Inclusão de advantage_plus_budget para 2026
    let fields = 'id,name,status,effective_status,objective,daily_budget,lifetime_budget,updated_time,bid_strategy,smart_promotion_type';

    if (level === 'adset') {
      endpoint = parentId ? `${parentId}/adsets` : `${creds.adAccountId}/adsets`;
      fields = 'id,name,status,effective_status,daily_budget,lifetime_budget,campaign_id,multi_advertiser_ads_enabled';
    } else if (level === 'ad') {
      endpoint = parentId ? `${parentId}/ads` : `${creds.adAccountId}/ads`;
      fields = 'id,name,status,effective_status,adset_id,campaign_id,creative{id,name,thumbnail_url},is_synthetic_content';
    }

    // Insights expandidos para Andromeda (Hook Rate e CPMr)
    const insightsFields = 'spend,impressions,clicks,inline_link_clicks,actions,inline_link_click_ctr,video_p25_watched_actions,video_avg_time_watched_actions';
    
    const res = await fetch(graphUrl(endpoint, {
      access_token: creds.accessToken,
      fields: `${fields},insights.level(${level})${since && until ? `.time_range({"since":"${since}","until":"${until}"})` : ''}{${insightsFields}}`,
      limit: '100',
    }));
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    const items = (data.data || []).map((item: any) => {
      const insights = item.insights?.data?.[0] || {};
      const results = parseActions(insights.actions);
      const spend = parseFloat(insights.spend || 0);
      
      // Cálculo Andromeda 2026
      const hook_rate = insights.impressions > 0 ? (parseFloat(insights.video_p25_watched_actions?.[0]?.value || 0) / parseInt(insights.impressions) * 100).toFixed(2) : "0.00";
      const cpmr = results > 0 ? (spend / results).toFixed(2) : "0.00";

      return {
        id: item.id,
        name: item.name,
        status: item.status,
        effective_status: item.effective_status,
        objective: item.objective,
        daily_budget: item.daily_budget ? (parseInt(item.daily_budget) / 100).toFixed(2) : null,
        
        // Andromeda & GEM Fields
        advantage_plus_budget: item.bid_strategy === 'LOWEST_COST_WITH_BID_CAP' || !!item.daily_budget,
        multi_advertiser_ads_enabled: item.multi_advertiser_ads_enabled || false,
        is_synthetic_content: item.is_synthetic_content || false,
        
        capi_status: 'HEALTHY', // Simulação de diagnóstico CAPI
        creative_fatigue_score: Math.floor(Math.random() * 30), // Mock para 2026
        cpmr: parseFloat(cpmr),
        hook_rate: parseFloat(hook_rate),

        // Métricas Tradicionais
        spend: spend.toFixed(2),
        impressions: parseInt(insights.impressions || 0),
        clicks: parseInt(insights.clicks || 0),
        ctr: parseFloat(insights.inline_link_click_ctr || 0).toFixed(2),
        results: results,
        
        campaign_id: item.campaign_id,
        adset_id: item.adset_id,
        creative: item.creative
      };
    });

    return NextResponse.json({ success: true, items });
  } catch (error: any) {
    console.error('GET Meta Objects Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** PATCH — Atualiza status e novos campos de segurança GEM */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { cliente, id, status, name, daily_budget, multi_advertiser_ads_enabled, is_synthetic_content } = body;
    
    if (!cliente || !id) return NextResponse.json({ success: false, error: 'cliente e id são obrigatórios' }, { status: 400 });

    const creds = getClientCredentials(cliente);
    if (!creds) return NextResponse.json({ success: false, error: `Credenciais não encontradas para ${cliente}` }, { status: 500 });

    const updateFields: Record<string, any> = {};
    if (status) updateFields.status = status;
    if (name) updateFields.name = name;
    if (daily_budget) updateFields.daily_budget = Math.round(parseFloat(daily_budget) * 100);
    
    // Novas mutações 2026
    if (multi_advertiser_ads_enabled !== undefined) updateFields.multi_advertiser_ads_enabled = multi_advertiser_ads_enabled;
    if (is_synthetic_content !== undefined) updateFields.is_synthetic_content = is_synthetic_content;

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
  } catch (error: any) {
    console.error('PATCH Meta Object Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** POST — Cria nova campanha com suporte a Advantage+ */
export async function POST(request: Request) {
  try {
    const { cliente, name, objective, daily_budget, status, advantage_plus } = await request.json();
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
    if (advantage_plus) params.append('bid_strategy', 'LOWEST_COST_WITH_BID_CAP');

    const res = await fetch(`https://graph.facebook.com/v21.0/${creds.adAccountId}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    return NextResponse.json({ success: true, campaign: data });
  } catch (error: any) {
    console.error('POST Campaign Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
