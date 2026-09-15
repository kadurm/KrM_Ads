import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const body = await request.json();
    const { cliente, rows } = body;

    if (!cliente) {
      return NextResponse.json({ success: false, error: 'Cliente não especificado.' }, { status: 400 });
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Nenhum dado válido para importação.' }, { status: 400 });
    }

    const slug = cliente.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '');

    const dbCliente = await prisma.cliente.findFirst({
      where: {
        OR: [
          { nome: { equals: cliente, mode: 'insensitive' } },
          { slug: { equals: slug, mode: 'insensitive' } },
          { slug: { equals: cliente.toLowerCase().replace(/ /g, ''), mode: 'insensitive' } }
        ]
      }
    });

    if (!dbCliente) {
      return NextResponse.json({ success: false, error: `Cliente "${cliente}" não encontrado no banco de dados.` }, { status: 404 });
    }

    // Carregar ou registrar campanhas necessárias
    const campanhasExistentes = await prisma.campanha.findMany({
      where: { cliente_id: dbCliente.id }
    });
    const campMap = new Map();
    campanhasExistentes.forEach(c => {
      campMap.set(c.nome_gerado.trim().toLowerCase(), c);
      campMap.set(c.meta_id, c);
    });

    let campaignsCreated = 0;
    const aggregatedMetrics = new Map();

    for (const row of rows) {
      const campName = (row.campaignName || 'Campanha Importada').trim();
      const normCampName = campName.toLowerCase();

      let camp = campMap.get(normCampName);
      if (!camp) {
        const syntheticMetaId = `imported_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        camp = await prisma.campanha.create({
          data: {
            cliente_id: dbCliente.id,
            nome_gerado: campName,
            meta_id: syntheticMetaId,
            objetivo: campName.toUpperCase().includes('MESSAGE') ? 'OUTCOME_LEADS' : (campName.toUpperCase().includes('TRAFFIC') ? 'OUTCOME_TRAFFIC' : 'UNKNOWN'),
            tipo_orcamento: 'UNKNOWN'
          }
        });
        campMap.set(normCampName, camp);
        campaignsCreated++;
      }

      const dateStr = row.date || new Date().toISOString().split('T')[0];
      const spend = parseFloat(row.spend) || 0;
      const impressions = parseInt(row.impressions) || 0;
      const reach = parseInt(row.reach) || 0;
      const clicks = parseInt(row.clicks) || 0;
      const visits = parseInt(row.profileVisits) || 0;
      const leads = parseInt(row.leads) || 0;

      const aggKey = `${camp.id}_${dateStr}`;
      if (!aggregatedMetrics.has(aggKey)) {
        aggregatedMetrics.set(aggKey, {
          campId: camp.id,
          dateStr,
          dataInsight: new Date(`${dateStr}T00:00:00.000Z`),
          spend: 0,
          impressions: 0,
          reach: 0,
          clicks: 0,
          visits: 0,
          leads: 0
        });
      }

      const item = aggregatedMetrics.get(aggKey);
      item.spend += spend;
      item.impressions += impressions;
      item.reach += reach;
      item.clicks += clicks;
      item.visits += visits;
      item.leads += leads;
    }

    let upsertedCount = 0;
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalVisits = 0;
    let totalLeads = 0;

    for (const item of aggregatedMetrics.values()) {
      const finalSpend = parseFloat(item.spend.toFixed(2));
      await prisma.metricaCampanha.upsert({
        where: {
          campanha_id_data: {
            campanha_id: item.campId,
            data: item.dataInsight
          }
        },
        update: {
          impressoes: item.impressions,
          alcance: item.reach,
          cliques: item.clicks,
          visitas_perfil: item.visits,
          conversas_leads: item.leads,
          valor_investido: finalSpend
        },
        create: {
          campanha_id: item.campId,
          data: item.dataInsight,
          impressoes: item.impressions,
          alcance: item.reach,
          cliques: item.clicks,
          visitas_perfil: item.visits,
          conversas_leads: item.leads,
          valor_investido: finalSpend
        }
      });

      upsertedCount++;
      totalSpend += item.spend;
      totalImpressions += item.impressions;
      totalClicks += item.clicks;
      totalVisits += item.visits;
      totalLeads += item.leads;
    }

    return NextResponse.json({
      success: true,
      message: `${upsertedCount} registros consolidados e sincronizados com fidelidade 100% para ${dbCliente.nome}!`,
      summary: {
        totalRows: rows.length,
        consolidatedRecords: upsertedCount,
        campaignsCreated,
        totalSpend: parseFloat(totalSpend.toFixed(2)),
        totalImpressions,
        totalClicks,
        totalVisits,
        totalLeads
      }
    });
  } catch (error) {
    console.error('[Meta Import API] Erro na importação:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
