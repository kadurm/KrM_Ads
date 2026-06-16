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

    // Fetch Instagram followers count details
    const clientes = await prisma.cliente.findMany({
      select: {
        id: true,
        nome: true,
      }
    });

    let totalSeguidoresAtual = 0;
    let totalDeltaPeriodo = 0;

    for (const client of clientes) {
      // Get the latest snapshot
      const latestMetric = await prisma.metricaContaDiaria.findFirst({
        where: { cliente_id: client.id },
        orderBy: { data: 'desc' },
        select: { followers_count: true }
      });

      const currentFollowers = latestMetric ? latestMetric.followers_count : 0;
      totalSeguidoresAtual += currentFollowers;

      // Get delta within selected date range
      const rangeMetrics = await prisma.metricaContaDiaria.findMany({
        where: {
          cliente_id: client.id,
          data: {
            ...(since || until ? {
              ...(since ? { gte: new Date(since + 'T00:00:00') } : {}),
              ...(until ? { lte: new Date(until + 'T23:59:59') } : {})
            } : {})
          }
        },
        orderBy: { data: 'asc' }
      });

      let delta = 0;
      if (rangeMetrics.length >= 2) {
        const oldestInRange = rangeMetrics[0].followers_count;
        const newestInRange = rangeMetrics[rangeMetrics.length - 1].followers_count;
        delta = newestInRange - oldestInRange;
      } else if (rangeMetrics.length === 1 && since) {
        const previousMetric = await prisma.metricaContaDiaria.findFirst({
          where: {
            cliente_id: client.id,
            data: {
              lt: new Date(since + 'T00:00:00')
            }
          },
          orderBy: { data: 'desc' },
          select: { followers_count: true }
        });
        if (previousMetric) {
          delta = rangeMetrics[0].followers_count - previousMetric.followers_count;
        }
      }
      totalDeltaPeriodo += delta;
    }

    return NextResponse.json({
      success: true,
      kpis: {
        totalPago,
        totalPendente,
        totalVencido,
        totalGlobal: totalPago + totalPendente + totalVencido
      },
      followersInfo: {
        total: totalSeguidoresAtual,
        delta: totalDeltaPeriodo
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
