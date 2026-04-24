import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const cliente = searchParams.get('cliente');

    if (!cliente) return NextResponse.json({ success: false, error: 'Cliente não especificado' }, { status: 400 });

    const leads = await prisma.lead.findMany({
      where: {
        cliente: { nome: cliente }
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

    const clienteDb = await prisma.cliente.findFirst({ where: { nome: cliente } });
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

    return NextResponse.json({ success: true, lead });
  } catch (error) {
    console.error('CRM POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { id, status, valor, nome, contato } = await request.json();

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        status,
        valor: valor !== undefined ? parseFloat(valor) : undefined,
        nome,
        contato
      }
    });

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
