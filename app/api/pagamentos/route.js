import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

// GET /api/pagamentos?cliente=X&since=Y&until=Z
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

    const transacoes = await prisma.transacao.findMany({
      where: {
        cliente_id: cliente.id,
        ...(since || until ? { criado_em: dateFilter } : {}),
      },
      include: {
        metodo: true,
        nota_fiscal: true,
      },
      orderBy: { criado_em: 'desc' },
    });

    const metodos = await prisma.metodoPagamento.findMany({
      where: { cliente_id: cliente.id, ativo: true },
      orderBy: { is_principal: 'desc' },
    });

    // KPIs
    const totalPago = transacoes
      .filter(t => t.status === 'PAGO')
      .reduce((acc, t) => acc + parseFloat(t.valor), 0);
    const totalPendente = transacoes
      .filter(t => t.status === 'PENDENTE')
      .reduce((acc, t) => acc + parseFloat(t.valor), 0);
    const totalVencido = transacoes
      .filter(t => t.status === 'VENCIDO')
      .reduce((acc, t) => acc + parseFloat(t.valor), 0);

    const proximoVencimento = transacoes
      .filter(t => t.status === 'PENDENTE' && t.data_vencimento)
      .sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento))[0];

    return NextResponse.json({
      success: true,
      transacoes,
      metodos,
      kpis: {
        totalPago,
        totalPendente,
        totalVencido,
        totalGeral: totalPago + totalPendente + totalVencido,
        proximoVencimento: proximoVencimento?.data_vencimento || null,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar pagamentos:', error);
    return NextResponse.json({ success: false, error: 'Erro interno ao buscar pagamentos.' }, { status: 500 });
  }
}

// POST /api/pagamentos — Cria nova transação
export async function POST(req) {
  try {
    const body = await req.json();
    const { cliente, tipo, categoria, descricao, valor, data_vencimento, metodo_pagamento_id } = body;

    if (!cliente || !descricao || !valor) {
      return NextResponse.json({ success: false, error: 'Campos obrigatórios: cliente, descricao, valor.' }, { status: 400 });
    }

    const clienteDb = await prisma.cliente.findFirst({ where: { nome: cliente } });
    if (!clienteDb) {
      return NextResponse.json({ success: false, error: 'Cliente não encontrado.' }, { status: 404 });
    }

    const transacao = await prisma.transacao.create({
      data: {
        cliente_id: clienteDb.id,
        tipo: tipo || 'COBRANCA',
        categoria: categoria || 'ADS',
        descricao,
        valor: parseFloat(valor),
        status: 'PENDENTE',
        data_vencimento: data_vencimento ? new Date(data_vencimento) : null,
        metodo_pagamento_id: metodo_pagamento_id || null,
        referencia: `KRM-${Date.now().toString(36).toUpperCase()}`,
      },
    });

    return NextResponse.json({ success: true, transacao });
  } catch (error) {
    console.error('Erro ao criar transação:', error);
    return NextResponse.json({ success: false, error: 'Erro interno ao criar transação.' }, { status: 500 });
  }
}

// PATCH /api/pagamentos — Atualiza transação (status, pagamento, etc.)
export async function PATCH(req) {
  try {
    const body = await req.json();
    const { id, status, data_pagamento } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID da transação obrigatório.' }, { status: 400 });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (status === 'PAGO') updateData.data_pagamento = data_pagamento ? new Date(data_pagamento) : new Date();

    const transacao = await prisma.transacao.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, transacao });
  } catch (error) {
    console.error('Erro ao atualizar transação:', error);
    return NextResponse.json({ success: false, error: 'Erro interno ao atualizar transação.' }, { status: 500 });
  }
}

// DELETE /api/pagamentos?id=X
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID obrigatório.' }, { status: 400 });
    }

    // Remove NF vinculada primeiro
    await prisma.notaFiscal.deleteMany({ where: { transacao_id: id } });
    await prisma.transacao.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar transação:', error);
    return NextResponse.json({ success: false, error: 'Erro interno ao deletar transação.' }, { status: 500 });
  }
}
