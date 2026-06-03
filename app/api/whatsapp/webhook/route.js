import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const clienteSlug = searchParams.get('cliente');

    if (!clienteSlug) {
      console.warn('[WhatsApp Webhook Skip] Cliente não especificado nos parâmetros da URL.');
      return NextResponse.json({ success: false, error: 'Cliente não especificado' }, { status: 400 });
    }

    const clienteDb = await prisma.cliente.findFirst({
      where: {
        OR: [
          { slug: clienteSlug },
          { nome: clienteSlug }
        ]
      }
    });

    if (!clienteDb) {
      console.warn(`[WhatsApp Webhook Skip] Cliente '${clienteSlug}' não localizado no banco.`);
      return NextResponse.json({ success: false, error: 'Cliente não cadastrado' }, { status: 404 });
    }

    const payload = await request.json();
    console.log(`[WhatsApp Webhook Received] Payload para ${clienteDb.nome}:`, JSON.stringify(payload));

    // --- PARSER DE PAYLOAD ---
    let senderPhone = '';
    let senderName = '';
    let messageText = '';

    // 1. Detecção do formato Evolution API
    if (payload.event && payload.data) {
      const data = payload.data;
      senderPhone = data.key?.remoteJid || data.sender || '';
      senderName = data.pushName || data.key?.pushName || 'Contato WhatsApp';
      messageText = data.message?.conversation || data.text?.message || data.message?.extendedTextMessage?.text || '';
    } 
    // 2. Detecção do formato Z-API
    else if (payload.phone && (payload.senderName || payload.text)) {
      senderPhone = payload.phone;
      senderName = payload.senderName || 'Contato WhatsApp';
      messageText = payload.text?.message || payload.text || '';
    } 
    // 3. Fallback genérico
    else {
      senderPhone = payload.sender || payload.phone || '';
      senderName = payload.name || payload.pushname || 'Contato WhatsApp';
      messageText = payload.body || payload.text || '';
    }

    // Limpa remoteJid do whatsapp (remove @s.whatsapp.net se houver)
    senderPhone = senderPhone.split('@')[0].replace(/\D/g, '');

    if (!senderPhone) {
      console.warn('[WhatsApp Webhook Skip] Não foi possível extrair o número de telefone.');
      return NextResponse.json({ success: true, warning: 'Telefone não extraído' });
    }

    // Verifica se já existe um lead com esse número nas últimas 24h para evitar duplicações
    const umDiaAtras = new Date();
    umDiaAtras.setDate(umDiaAtras.getDate() - 1);

    const leadExistente = await prisma.lead.findFirst({
      where: {
        cliente_id: clienteDb.id,
        contato: senderPhone,
        criado_em: { gte: umDiaAtras }
      }
    });

    if (leadExistente) {
      console.log(`[WhatsApp Webhook] Lead existente detectado para ${senderPhone}. Registrando conversa como nota.`);
      // Registra a mensagem como nota no histórico do lead
      await prisma.nota.create({
        data: {
          lead_id: leadExistente.id,
          texto: `[WhatsApp Recebido] ${messageText}`,
          autor: 'WhatsApp Bot'
        }
      });
      return NextResponse.json({ success: true, status: 'conversação adicionada ao histórico' });
    }

    // Cria o novo lead no CRM
    const novoLead = await prisma.lead.create({
      data: {
        cliente_id: clienteDb.id,
        nome: senderName,
        contato: senderPhone,
        status: 'NOVO',
        origem: 'WhatsApp Atendimento',
        valor: 0
      }
    });

    console.log(`[WhatsApp Webhook] Novo lead cadastrado no CRM: ${senderName} (${senderPhone})`);

    // Registra a mensagem inicial como nota
    if (messageText) {
      await prisma.nota.create({
        data: {
          lead_id: novoLead.id,
          texto: `[Mensagem Inicial WhatsApp] ${messageText}`,
          autor: 'WhatsApp Bot'
        }
      });
    }

    return NextResponse.json({ success: true, lead_id: novoLead.id });
  } catch (error) {
    console.error('[WhatsApp Webhook Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
