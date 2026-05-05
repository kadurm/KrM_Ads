import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

const prisma = new PrismaClient();

export async function POST(req) {
  try {
    const { cliente, eventName, testCode } = await req.json();

    if (!cliente) {
      return NextResponse.json({ success: false, error: 'Cliente não informado.' }, { status: 400 });
    }

    const clienteDb = await prisma.cliente.findFirst({ where: { nome: cliente } });
    if (!clienteDb) {
      return NextResponse.json({ success: false, error: 'Cliente não encontrado.' }, { status: 404 });
    }

    const pixelId = clienteDb.meta_pixel_id;
    const accessToken = clienteDb.meta_access_token;

    if (!pixelId || !accessToken) {
      return NextResponse.json({ success: false, error: 'Pixel ID ou Access Token ausente.' }, { status: 400 });
    }

    // Gerar IDs para o evento
    const eventId = `test-${Date.now()}`;
    const timestamp = Math.floor(Date.now() / 1000);

    const payload = {
      data: [
        {
          event_name: eventName || 'PageView',
          event_time: timestamp,
          event_id: eventId,
          action_source: 'website',
          user_data: {
            client_ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
            client_user_agent: req.headers.get('user-agent'),
            // FBP e FBC seriam bons aqui em um cenário real
          },
          custom_data: {
            is_test_event: true
          }
        }
      ]
    };

    if (testCode) {
      payload.test_event_code = testCode;
    }

    const res = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (!res.ok) {
        return NextResponse.json({ success: false, error: result.error?.message || 'Erro na Meta API' }, { status: res.status });
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Erro ao testar tracking:', error);
    return NextResponse.json({ success: false, error: 'Erro interno ao disparar evento.' }, { status: 500 });
  }
}
