import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const since = searchParams.get('since');
    const until = searchParams.get('until');

    const dateFilter = {};
    if (since) dateFilter.gte = new Date(since + 'T00:00:00');
    if (until) dateFilter.lte = new Date(until + 'T23:59:59');

    const transacoes = await prisma.transacao.findMany({
      where: {
        ...(since || until ? { criado_em: dateFilter } : {}),
      },
      include: {
        cliente: {
            select: { nome: true }
        }
      },
      orderBy: { criado_em: 'desc' },
    });

    // Consolidated KPIs
    const totalPago = transacoes
      .filter(t => t.status === 'PAGO')
      .reduce((acc, t) => acc + parseFloat(t.valor), 0);
    const totalPendente = transacoes
      .filter(t => t.status === 'PENDENTE')
      .reduce((acc, t) => acc + parseFloat(t.valor), 0);
    const totalVencido = transacoes
      .filter(t => t.status === 'VENCIDO')
      .reduce((acc, t) => acc + parseFloat(t.valor), 0);

    // Revenue per client
    const receitaPorCliente = {};
    transacoes.filter(t => t.status === 'PAGO').forEach(t => {
        const nome = t.cliente.nome;
        receitaPorCliente[nome] = (receitaPorCliente[nome] || 0) + parseFloat(t.valor);
    });

    const rankingClientes = Object.entries(receitaPorCliente)
        .map(([nome, total]) => ({ nome, total }))
        .sort((a, b) => b.total - a.total);

    // Revenue per category
    const receitaPorCategoria = {};
    transacoes.filter(t => t.status === 'PAGO').forEach(t => {
        const cat = t.categoria || 'OUTROS';
        receitaPorCategoria[cat] = (receitaPorCategoria[cat] || 0) + parseFloat(t.valor);
    });

    const categoriasConsolidadas = Object.entries(receitaPorCategoria)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    return NextResponse.json({
      success: true,
      kpis: {
        totalPago,
        totalPendente,
        totalVencido,
        totalGlobal: totalPago + totalPendente + totalVencido
      },
      rankingClientes,
      categoriasConsolidadas,
      recentes: transacoes.slice(0, 10)
    });
  } catch (error) {
    console.error('Erro ao buscar financeiro global:', error);
    return NextResponse.json({ success: false, error: 'Erro interno.' }, { status: 500 });
  }
}
