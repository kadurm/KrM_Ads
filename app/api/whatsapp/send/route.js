import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Função utilitária para disparar mensagem via WhatsApp API (Evolution ou Z-API)
 */
export async function sendWhatsAppMessage(cliente, toPhone, messageText) {
  const url = cliente.whatsapp_instance_url;
  const name = cliente.whatsapp_instance_name;
  const token = cliente.whatsapp_instance_token;

  if (!url || !name || !token) {
    console.log(`[WhatsApp Skip] Configurações de WhatsApp incompletas para: ${cliente.nome}`);
    return { success: false, error: 'Configuração incompleta' };
  }

  // Normaliza número de telefone (apenas números)
  let cleanPhone = toPhone.replace(/\D/g, '');
  if (!cleanPhone.startsWith('55') && cleanPhone.length <= 11) {
    cleanPhone = '55' + cleanPhone; // Fallback código país Brasil
  }

  try {
    let targetUrl = '';
    let headers = { 'Content-Type': 'application/json' };
    let bodyPayload = {};

    const isZapi = url.toLowerCase().includes('z-api') || url.toLowerCase().includes('zapi');

    if (isZapi) {
      // Formato Z-API
      // Endpoint padrão: {url}/instances/{name}/token/{token}/send-text
      targetUrl = `${url.replace(/\/$/, '')}/instances/${name}/token/${token}/send-text`;
      bodyPayload = {
        phone: cleanPhone,
        message: messageText
      };
    } else {
      // Formato padrão Evolution API (Cloud / v1 / v2)
      // Endpoint padrão: {url}/message/sendText/{name}
      targetUrl = `${url.replace(/\/$/, '')}/message/sendText/${name}`;
      headers['apikey'] = token;
      bodyPayload = {
        number: cleanPhone,
        options: {
          delay: 1000,
          presence: 'composing'
        },
        textMessage: {
          text: messageText
        }
      };
    }

    console.log(`[WhatsApp Dispatch] Enviando para ${cleanPhone} via ${isZapi ? 'Z-API' : 'Evolution'}...`);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyPayload)
    });

    const result = await response.json();
    console.log(`[WhatsApp Response]`, result);
    return { success: response.ok, data: result };
  } catch (error) {
    console.error(`[WhatsApp Error] Falha ao enviar mensagem para ${cleanPhone}:`, error.message);
    return { success: false, error: error.message };
  }
}

export async function POST(request) {
  try {
    const { clienteId, phone, message } = await request.json();

    if (!clienteId || !phone || !message) {
      return NextResponse.json({ success: false, error: 'Parâmetros ausentes' }, { status: 400 });
    }

    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) {
      return NextResponse.json({ success: false, error: 'Cliente não encontrado' }, { status: 404 });
    }

    const dispatch = await sendWhatsAppMessage(cliente, phone, message);
    return NextResponse.json({ success: dispatch.success, result: dispatch.data, error: dispatch.error });
  } catch (error) {
    console.error('[WhatsApp Route Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
