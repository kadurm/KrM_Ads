import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');
    const until = searchParams.get('until');

    // Normalização de datas
    const dateUntil = until ? new Date(until + 'T23:59:59Z') : new Date();
    const dateSince = since ? new Date(since + 'T00:00:00Z') : new Date(new Date().setDate(dateUntil.getDate() - 30));

    // 1. Busca todos os clientes e seus dados
    const clientes = await prisma.cliente.findMany({
      include: {
        campanhas: {
          include: {
            metricas: {
              where: { data: { gte: dateSince, lte: dateUntil } }
            }
          }
        },
        leads: {
          where: { 
            data: { gte: dateSince, lte: dateUntil },
            status: 'FECHADO' 
          }
        }
      }
    });

    const portfolioData = clientes.map(cliente => {
      let totalSpend = 0;
      let totalLeads = 0;
      let totalImpressions = 0;
      let totalReach = 0;
      let totalRevenue = cliente.leads.reduce((acc, lead) => acc + Number(lead.valor), 0);

      cliente.campanhas.forEach(camp => {
        camp.metricas.forEach(metrica => {
          totalSpend += Number(metrica.valor_investido);
          totalLeads += metrica.conversas_leads;
          totalImpressions += metrica.impressoes;
          totalReach = Math.max(totalReach, metrica.alcance); // Simplificação
        });
      });

      return {
        id: cliente.id,
        nome: cliente.nome,
        setor: cliente.setor || 'Geral',
        spend: totalSpend,
        leads: totalLeads,
        revenue: totalRevenue,
        impressions: totalImpressions,
        reach: totalReach,
        cac: totalLeads > 0 ? totalSpend / totalLeads : 0,
        roas: totalSpend > 0 ? totalRevenue / totalSpend : 0
      };
    });

    // 2. Agregação Global
    const globalTotals = portfolioData.reduce((acc, curr) => ({
      totalSpend: acc.totalSpend + curr.spend,
      totalRevenue: acc.totalRevenue + curr.revenue,
      totalLeads: acc.totalLeads + curr.leads,
      totalImpressions: acc.totalImpressions + curr.impressions,
      totalReach: acc.totalReach + curr.reach
    }), { totalSpend: 0, totalRevenue: 0, totalLeads: 0, totalImpressions: 0, totalReach: 0 });

    // 3. Agrupamento por Setor
    const sectorMap = {};
    portfolioData.forEach(item => {
      if (!sectorMap[item.setor]) {
        sectorMap[item.setor] = { sector: item.setor, spend: 0, revenue: 0, leads: 0 };
      }
      sectorMap[item.setor].spend += item.spend;
      sectorMap[item.setor].revenue += item.revenue;
      sectorMap[item.setor].leads += item.leads;
    });

    const sectors = Object.values(sectorMap);

    return NextResponse.json({
      success: true,
      global: globalTotals,
      sectors,
      clients: portfolioData.sort((a, b) => b.spend - a.spend)
    });

  } catch (error) {
    console.error('Portfolio API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
