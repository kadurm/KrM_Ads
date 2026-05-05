import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

// GET /api/pagamentos/notas?cliente=X&since=Y&until=Z
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const clienteNome = searchParams.get('cliente');
    const since = searchParams.get('since');
    const until = searchParams.get('until');

    if (!clienteNome) {
      return NextResponse.json({ success: false, error: 'Cliente não informado.' }, { status: 400 });
    }

    const cliente = await prisma.cliente.findFirst({ where: { nome: clienteNome } });
    if (!cliente) {
      return NextResponse.json({ success: false, error: 'Cliente não encontrado.' }, { status: 404 });
    }

    const dateFilter = {};
    if (since) dateFilter.gte = new Date(since + 'T00:00:00');
    if (until) dateFilter.lte = new Date(until + 'T23:59:59');

    const notas = await prisma.notaFiscal.findMany({
      where: {
        cliente_id: cliente.id,
        ...(since || until ? { criado_em: dateFilter } : {}),
      },
      include: {
        transacao: true,
      },
      orderBy: { criado_em: 'desc' },
    });

    return NextResponse.json({ success: true, notas });
  } catch (error) {
    console.error('Erro ao buscar notas fiscais:', error);
    return NextResponse.json({ success: false, error: 'Erro interno.' }, { status: 500 });
  }
}

// POST /api/pagamentos/notas — Emite nova NF
export async function POST(req) {
  try {
    const body = await req.json();
    const { cliente, transacao_id, valor, descricao } = body;

    if (!cliente || !valor || !descricao) {
      return NextResponse.json({ success: false, error: 'Campos obrigatórios: cliente, valor, descricao.' }, { status: 400 });
    }

    const clienteDb = await prisma.cliente.findFirst({ where: { nome: cliente } });
    if (!clienteDb) {
      return NextResponse.json({ success: false, error: 'Cliente não encontrado.' }, { status: 404 });
    }

    // Gera número sequencial baseado no total de NFs existentes
    const count = await prisma.notaFiscal.count({ where: { cliente_id: clienteDb.id } });
    const numero = count + 1;

    const nota = await prisma.notaFiscal.create({
      data: {
        cliente_id: clienteDb.id,
        transacao_id: transacao_id || null,
        numero,
        valor: parseFloat(valor),
        descricao,
        status: 'EMITIDA',
      },
    });

    return NextResponse.json({ success: true, nota });
  } catch (error) {
    console.error('Erro ao emitir nota fiscal:', error);
    return NextResponse.json({ success: false, error: 'Erro interno ao emitir NF.' }, { status: 500 });
  }
}

// PATCH /api/pagamentos/notas — Cancelar NF
export async function PATCH(req) {
  try {
    const body = await req.json();
    const { id, status } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID obrigatório.' }, { status: 400 });
    }

    const nota = await prisma.notaFiscal.update({
      where: { id },
      data: { status: status || 'CANCELADA' },
    });

    return NextResponse.json({ success: true, nota });
  } catch (error) {
    console.error('Erro ao atualizar NF:', error);
    return NextResponse.json({ success: false, error: 'Erro interno.' }, { status: 500 });
  }
}
