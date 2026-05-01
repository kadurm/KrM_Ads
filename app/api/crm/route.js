import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

/** Função para gerar hash SHA256 exigido pela Meta CAPI */
function hashData(data) {
  if (!data) return null;
  return crypto.createHash('sha256').update(String(data).trim().toLowerCase()).digest('hex');
}

/** Motor de Disparo CAPI (Conversões Offline) */
async function sendCapiEvent(cliente, lead, eventName) {
  try {
    const shortName = cliente.nome.split(' ')[0];
    const accessToken = process.env[`META_ACCESS_TOKEN_${shortName}`] || cliente.meta_access_token;
    const pixelId = cliente.meta_pixel_id;

    if (!accessToken || !pixelId) {
      console.log(`[CAPI Skip] Credenciais ausentes para ${cliente.nome}`);
      return;
    }

    const payload = {
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          action_source: 'system_generated',
          user_data: {
            // Tenta extrair telefone do campo contato para melhorar o Match Rate
            ph: lead.contato ? [hashData(lead.contato.replace(/\D/g, ''))] : [],
            client_user_agent: 'KrM_Ads_CRM_v2',
          },
          custom_data: {
            currency: 'BRL',
            value: parseFloat(lead.valor || 0)
          }
        }
      ]
    };

    console.log(`[CAPI Trigger] Enviando ${eventName} para ${cliente.nome}...`);
    
    const res = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    console.log(`[CAPI Response]`, result);
  } catch (e) {
    console.error(`[CAPI Error]`, e.message);
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const cliente = searchParams.get('cliente');

    if (!cliente) return NextResponse.json({ success: false, error: 'Cliente não especificado' }, { status: 400 });

    const leads = await prisma.lead.findMany({
      where: {
        OR: [
          { cliente: { slug: cliente } },
          { cliente: { nome: cliente } }
        ]
      },
      include: {
        notas: { orderBy: { criado_em: 'desc' } }
      },
      orderBy: { data: 'desc' }
    });

    return NextResponse.json({ success: true, leads });
  } catch (error) {
    console.error('CRM GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { cliente, nome, contato, status, valor, origem, data } = await request.json();

    if (!cliente || !nome) return NextResponse.json({ success: false, error: 'Dados incompletos' }, { status: 400 });

    const clienteDb = await prisma.cliente.findFirst({ 
      where: { 
        OR: [
          { slug: cliente },
          { nome: cliente }
        ]
      } 
    });
    if (!clienteDb) return NextResponse.json({ success: false, error: 'Cliente não encontrado' }, { status: 404 });

    const lead = await prisma.lead.create({
      data: {
        cliente_id: clienteDb.id,
        nome,
        contato,
        status: status || 'NOVO',
        valor: parseFloat(valor || 0),
        origem,
        data: data ? new Date(data) : new Date()
      }
    });

    // Gatilho CAPI: Se criar como FECHADO, envia Purchase. Se novo, envia Lead.
    if (lead.status === 'FECHADO') {
      await sendCapiEvent(clienteDb, lead, 'Purchase');
    } else {
      await sendCapiEvent(clienteDb, lead, 'Lead');
    }

    return NextResponse.json({ success: true, lead });
  } catch (error) {
    console.error('CRM POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { id, status, valor, nome, contato } = await request.json();

    // Busca estado anterior para saber se o status mudou
    const oldLead = await prisma.lead.findUnique({ 
      where: { id },
      include: { cliente: true }
    });

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        status,
        valor: valor !== undefined ? parseFloat(valor) : undefined,
        nome,
        contato
      }
    });

    // Gatilho CAPI: Se o status mudou para FECHADO agora
    if (oldLead && oldLead.status !== 'FECHADO' && lead.status === 'FECHADO') {
      await sendCapiEvent(oldLead.cliente, lead, 'Purchase');
    }

    return NextResponse.json({ success: true, lead });
  } catch (error) {
    console.error('CRM PATCH Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    await prisma.lead.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('CRM DELETE Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
