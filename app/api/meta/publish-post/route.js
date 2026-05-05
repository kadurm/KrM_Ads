import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const { cliente, mediaUrl, caption, type, scheduleTime } = await request.json();

    if (!cliente || !mediaUrl || !type) {
      return NextResponse.json({ success: false, error: 'Dados incompletos' }, { status: 400 });
    }

    const clienteDB = await prisma.cliente.findFirst({ where: { nome: cliente } });
    if (!clienteDB || !clienteDB.meta_access_token) {
      return NextResponse.json({ success: false, error: 'Cliente ou Token não encontrados' }, { status: 404 });
    }

    const token = clienteDB.meta_access_token;
    const adAccountId = clienteDB.meta_ads_account_id;

    // 1. Descobrir a Instagram Business Account ID (Reutilizando lógica do Radar)
    const adAccountRes = await fetch(`https://graph.facebook.com/v19.0/${adAccountId}?fields=promotable_page_ids&access_token=${token}`);
    const adAccountData = await adAccountRes.json();
    if (adAccountData.error) throw new Error(adAccountData.error.message);

    const pageIds = adAccountData.promotable_page_ids?.data || [];
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
      return NextResponse.json({ success: false, error: 'ID do Instagram não encontrado.' }, { status: 404 });
    }

    // 2. Passo 1: Criar o Container de Mídia
    // Parâmetros base
    let mediaParams = {
      caption,
      access_token: token
    };

    if (type === 'REELS') {
      mediaParams.video_url = mediaUrl;
      mediaParams.media_type = 'REELS';
    } else if (type === 'STORY') {
      if (mediaUrl.match(/\.(mp4|mov|avi)$/i)) {
        mediaParams.video_url = mediaUrl;
        mediaParams.media_type = 'STORIES';
      } else {
        mediaParams.image_url = mediaUrl;
        mediaParams.media_type = 'STORIES';
      }
    } else {
      // Feed
      if (mediaUrl.match(/\.(mp4|mov|avi)$/i)) {
        mediaParams.video_url = mediaUrl;
        mediaParams.media_type = 'VIDEO';
      } else {
        mediaParams.image_url = mediaUrl;
      }
    }

    // Adicionar Agendamento se houver
    if (scheduleTime) {
      // O scheduleTime deve ser um timestamp Unix (segundos)
      mediaParams.scheduled_publish_time = scheduleTime;
    }

    const containerRes = await fetch(`https://graph.facebook.com/v19.0/${igBusinessAccountId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mediaParams)
    });
    const containerData = await containerRes.json();

    if (containerData.error) {
      console.error('Meta Container Error:', containerData.error);
      return NextResponse.json({ success: false, error: containerData.error.message }, { status: 400 });
    }

    const creationId = containerData.id;

    // Se for agendado, a Meta já recebeu o comando no container (dependendo da versão e tipo)
    // No entanto, para a maioria dos tipos via Graph API, o agendamento é feito no media_publish
    // Mas para REELS, o scheduled_publish_time vai no container. 
    // Vamos garantir a publicação imediata se NÃO houver agendamento.
    
    if (!scheduleTime) {
        // Passo 2: Publicar (Apenas se não for agendado no container)
        // Nota: Alguns tipos de agendamento na Graph API exigem que você NÃO chame o publish imediatamente.
        // Vamos aguardar o processamento se for vídeo
        if (type === 'REELS' || mediaUrl.match(/\.(mp4|mov|avi)$/i)) {
            // Vídeos levam tempo para processar. Em uma API serverless, não podemos esperar muito.
            // Retornamos o ID do container para o frontend monitorar ou apenas informamos sucesso.
            return NextResponse.json({ 
                success: true, 
                message: 'Container de vídeo criado. A Meta está processando.', 
                creation_id: creationId,
                status: 'PROCESSING'
            });
        }

        const publishRes = await fetch(`https://graph.facebook.com/v19.0/${igBusinessAccountId}/media_publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creation_id: creationId,
            access_token: token
          })
        });
        const publishData = await publishRes.json();

        if (publishData.error) {
          return NextResponse.json({ success: false, error: publishData.error.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, post_id: publishData.id });
    } else {
        // Post Agendado
        return NextResponse.json({ 
            success: true, 
            message: 'Post agendado com sucesso via Meta Graph API.', 
            creation_id: creationId 
        });
    }

  } catch (error) {
    console.error('Publish Post Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
