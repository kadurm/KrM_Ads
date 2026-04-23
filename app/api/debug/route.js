import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const rawAccountId = process.env.META_AD_ACCOUNT_ID_Solution;
    const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN_Solution;

    if (!rawAccountId || !ACCESS_TOKEN) {
      return NextResponse.json({ error: "Variáveis de ambiente ausentes" });
    }

    const AD_ACCOUNT_ID = rawAccountId.startsWith('act_') ? rawAccountId : `act_${rawAccountId}`;
    
    // Teste simples de 1 dia
    const timeRange = JSON.stringify({ since: '2026-03-01', until: '2026-03-02' });
    
    const testUrl = `https://graph.facebook.com/v21.0/${AD_ACCOUNT_ID}/insights?fields=campaign_id,campaign_name,spend&level=campaign&time_range=${encodeURIComponent(timeRange)}&access_token=${ACCESS_TOKEN}`;

    const res = await fetch(testUrl);
    const data = await res.json();

    return NextResponse.json({ 
      status: res.status,
      debugUrl: testUrl.replace(ACCESS_TOKEN, "HIDDEN"),
      metaResponse: data 
    });
  } catch (err) {
    return NextResponse.json({ error: err.message });
  }
}
