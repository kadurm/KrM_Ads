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

    // 1. Descobrir a Página vinculada à conta de anúncios
    const adAccountRes = await fetch(`https://graph.facebook.com/v19.0/${adAccountId}?fields=promotable_page_ids&access_token=${token}`);
    const adAccountData = await adAccountRes.json();

    if (adAccountData.error) {
      return NextResponse.json({ success: false, error: 'Erro ao buscar conta de anúncios: ' + adAccountData.error.message }, { status: 400 });
    }

    const pageIds = adAccountData.promotable_page_ids?.data || [];
    if (pageIds.length === 0) {
      return NextResponse.json({ success: false, error: 'Nenhuma página do Facebook vinculada a esta conta de anúncios.' }, { status: 404 });
    }

    // 2. Tentar encontrar a Instagram Business Account em qualquer uma das páginas
    let igBusinessAccountId = null;
    for (const page of pageIds) {
      const pageRes = await fetch(`https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account&access_token=${token}`);
      const pageData = await pageRes.json();
      if (pageData.instagram_business_account) {
        igBusinessAccountId = pageData.instagram_business_account.id;
        break;
      }
    }

    if (!igBusinessAccountId) {
      return NextResponse.json({ success: false, error: 'Nenhuma conta comercial do Instagram vinculada às páginas desta conta.' }, { status: 404 });
    }

    // 3. Buscar Mídias (Feed e Reels)
    const mediaRes = await fetch(`https://graph.facebook.com/v19.0/${igBusinessAccountId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&access_token=${token}&limit=20`);
    const mediaData = await mediaRes.json();

    // 4. Buscar Stories
    const storiesRes = await fetch(`https://graph.facebook.com/v19.0/${igBusinessAccountId}/stories?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&access_token=${token}`);
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
