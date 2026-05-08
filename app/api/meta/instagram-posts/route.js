import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const clienteNome = searchParams.get('cliente');

    if (!clienteNome) {
      return NextResponse.json({ success: false, error: 'Cliente não informado' }, { status: 400 });
    }

    const cliente = await prisma.cliente.findFirst({
      where: { nome: clienteNome }
    });

    const slug = clienteNome.replace(/[^a-zA-Z0-9]/g, '');
    const token = process.env[`META_ACCESS_TOKEN_${slug.toUpperCase()}`] || 
                  process.env[`META_ACCESS_TOKEN_${slug}`] ||
                  process.env[`META_ACCESS_TOKEN_GLOBAL`] || 
                  cliente?.meta_access_token;

    const rawAccountId = process.env[`META_AD_ACCOUNT_ID_${slug.toUpperCase()}`] || 
                         process.env[`META_AD_ACCOUNT_ID_${slug}`] ||
                         cliente?.meta_ads_account_id;

    if (!token || !rawAccountId) {
      return NextResponse.json({ success: false, error: 'Token da Meta ou ID da Conta não encontrados' }, { status: 404 });
    }

    const adAccountId = rawAccountId.startsWith('act_') ? rawAccountId : `act_${rawAccountId}`;

    // 1. Descobrir a Instagram Business Account via me/accounts
    let igBusinessAccountId = null;
    
    const accountsRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=instagram_business_account,name&access_token=${token}`);
    const accountsData = await accountsRes.json();

    if (accountsData.error) {
      return NextResponse.json({ success: false, error: 'Erro de permissão no Token: ' + accountsData.error.message }, { status: 400 });
    }

    if (accountsData.data && accountsData.data.length > 0) {
      for (const page of accountsData.data) {
        if (page.instagram_business_account) {
          igBusinessAccountId = page.instagram_business_account.id;
          break;
        }
      }
    }

    // Fallback: tentar buscar via Ad Account se me/accounts falhar ou retornar vazio
    if (!igBusinessAccountId && adAccountId) {
      try {
        const adAccountRes = await fetch(`https://graph.facebook.com/v19.0/${adAccountId}?fields=promote_pages{instagram_business_account}&access_token=${token}`);
        const adAccountData = await adAccountRes.json();
        
        if (adAccountData.promote_pages && adAccountData.promote_pages.data) {
           for (const page of adAccountData.promote_pages.data) {
             if (page.instagram_business_account) {
               igBusinessAccountId = page.instagram_business_account.id;
               break;
             }
           }
        }
      } catch (e) {
        console.error("Fallback ad account error:", e);
      }
    }

    if (!igBusinessAccountId) {
      return NextResponse.json({ success: false, error: 'Nenhuma conta comercial do Instagram vinculada às páginas acessíveis por este token.' }, { status: 404 });
    }

    // Process Date Filters
    const sinceParam = searchParams.get('since');
    const untilParam = searchParams.get('until');
    let dateFilters = '';
    if (sinceParam && sinceParam !== 'undefined' && sinceParam !== 'null') {
      const sinceDate = new Date(sinceParam + 'T00:00:00.000Z');
      dateFilters += `&since=${Math.floor(sinceDate.getTime() / 1000)}`;
    }
    if (untilParam && untilParam !== 'undefined' && untilParam !== 'null') {
      const untilDate = new Date(untilParam + 'T23:59:59.999Z');
      dateFilters += `&until=${Math.floor(untilDate.getTime() / 1000)}`;
    }

    // 3. Buscar Mídias (Feed e Reels)
    const mediaRes = await fetch(`https://graph.facebook.com/v19.0/${igBusinessAccountId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&access_token=${token}&limit=100${dateFilters}`);
    const mediaData = await mediaRes.json();

    // 4. Buscar Stories
    const storiesRes = await fetch(`https://graph.facebook.com/v19.0/${igBusinessAccountId}/stories?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&access_token=${token}${dateFilters}`);
    const storiesData = await storiesRes.json();

    const allMedia = mediaData.data || [];
    const stories = storiesData.data || [];

    // Categorização
    const response = {
      success: true,
      feed: allMedia.filter(m => m.media_type === 'IMAGE' || m.media_type === 'CAROUSEL_ALBUM'),
      reels: allMedia.filter(m => m.media_type === 'VIDEO'),
      stories: stories,
      ig_id: igBusinessAccountId
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Instagram Posts Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
