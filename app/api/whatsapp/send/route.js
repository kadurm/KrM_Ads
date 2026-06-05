import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { sendWhatsAppMessage } from '../../../../utils/whatsapp';

const prisma = new PrismaClient();

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
