import { NextResponse } from 'next/server';
import { MetaCampaign } from '@/types/meta-campaigns';

/**
 * Meta Ads 2026 - Centralized Campaign API
 * Updated with Legacy Fallbacks (Graceful Degradation)
 */

function graphUrl(path: string, query: Record<string, any>) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });
  return url.toString();
}

function getCredentials(clienteName: string) {
  const shortName = clienteName.split(' ')[0];
  const adAccountId = process.env[`META_AD_ACCOUNT_ID_${shortName}`];
  const accessToken = process.env[`META_ACCESS_TOKEN_${shortName}`];
  return { adAccountId: adAccountId?.startsWith('act_') ? adAccountId : `act_${adAccountId}`, accessToken };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cliente = searchParams.get('cliente');
    const level = searchParams.get('level') || 'campaign';
    const parentId = searchParams.get('parentId');

    if (!cliente) throw new Error('Cliente obrigatório');
    const { adAccountId, accessToken } = getCredentials(cliente);
    if (!adAccountId || !accessToken) throw new Error(`Credenciais ausentes para ${cliente}`);

    let endpoint = `${adAccountId}/campaigns`;
    let fields = 'id,name,status,objective,daily_budget,lifetime_budget,updated_time,bid_strategy';

    if (level === 'adset') {
      endpoint = parentId ? `${parentId}/adsets` : `${adAccountId}/adsets`;
      fields = 'id,name,status,daily_budget,lifetime_budget,campaign_id,multi_advertiser_ads_enabled';
    } else if (level === 'ad') {
      endpoint = parentId ? `${parentId}/ads` : `${adAccountId}/ads`;
      fields = 'id,name,status,adset_id,campaign_id,creative{id,thumbnail_url.width(800).height(800),image_url},is_synthetic_content';
    }

    const insightsFields = 'spend,impressions,actions,inline_link_click_ctr,video_p25_watched_actions';
    const historicalFields = 'spend,purchase_roas,actions';
    
    const url = graphUrl(endpoint, {
      access_token: accessToken,
      fields: `${fields},insights.level(${level}){${insightsFields}},historical_insights:insights.date_preset(last_7d).time_increment(1){${historicalFields}}`,
      limit: '50'
    });

    const res = await fetch(url);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    const items: MetaCampaign[] = (data.data || []).map((item: any) => {
      const insights = item.insights?.data?.[0] || {};
      const actions = insights.actions || [];
      const results = parseInt(actions.find((a: any) => a.action_type === 'onsite_conversion.messaging_conversation_started_7d')?.value || 0) +
                      parseInt(actions.find((a: any) => a.action_type === 'lead')?.value || 0);
      
      const spend = parseFloat(insights.spend || 0);
      const impressions = parseInt(insights.impressions || 0);
      const hook_rate = impressions > 0 ? (parseFloat(insights.video_p25_watched_actions?.[0]?.value || 0) / impressions * 100) : 0;

      // Map Historical Insights
      const historical_insights = (item.historical_insights?.data || []).map((h: any) => {
        const hActions = h.actions || [];
        const hResults = parseInt(hActions.find((a: any) => a.action_type === 'onsite_conversion.messaging_conversation_started_7d')?.value || 0) +
                         parseInt(hActions.find((a: any) => a.action_type === 'lead')?.value || 0);
        
        return {
          date: h.date_start,
          spend: parseFloat(h.spend || 0),
          purchase_roas: parseFloat(h.purchase_roas?.[0]?.value || 0),
          results: hResults
        };
      });

      // Safe Mapping with Fallbacks for Legacy Support
      return {
        id: item.id,
        name: item.name || 'Sem Nome',
        status: item.status || 'PAUSED',
        objective: item.objective || 'OUTCOME_TRAFFIC',
        daily_budget: item.daily_budget ? parseInt(item.daily_budget) / 100 : undefined,
        
        // 2026 Infrastructure - Defaults for legacy
        advantage_plus_budget: !!item.bid_strategy,
        multi_advertiser_ads_enabled: item.multi_advertiser_ads_enabled ?? false,
        is_synthetic_content: item.is_synthetic_content ?? false,
        
        // Andromeda Metrics - Initialized safely
        capi_status: 'HEALTHY', 
        creative_fatigue_score: 0, // Fallback safe
        cpmr: results > 0 ? spend / results : 0,
        hook_rate: hook_rate,
        
        spend,
        results,
        ctr: parseFloat(insights.inline_link_click_ctr || 0),
        impressions,
        
        campaign_id: item.campaign_id,
        adset_id: item.adset_id,
        creative: item.creative,
        historical_insights
      };
    });

    return NextResponse.json({ success: true, items });
  } catch (e: any) {
    console.error('API Sync Error:', e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { cliente, id, ...updates } = await request.json();
    const { accessToken } = getCredentials(cliente);
    if (!accessToken) throw new Error('Token de acesso não encontrado');
    
    const params = new URLSearchParams({ access_token: accessToken });
    Object.entries(updates).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      
      if (k === 'daily_budget' || k === 'lifetime_budget') {
        params.append(k, String(Math.round(Number(v) * 100)));
      } else if (typeof v === 'object') {
        params.append(k, JSON.stringify(v));
      } else {
        params.append(k, String(v));
      }
    });

    const res = await fetch(`https://graph.facebook.com/v21.0/${id}`, {
      method: 'POST',
      body: params
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
