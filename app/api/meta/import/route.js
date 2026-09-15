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

    let upsertedCount = 0;
    let campaignsCreated = 0;
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalVisits = 0;
    let totalLeads = 0;

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
      const dataInsight = new Date(`${dateStr}T00:00:00.000Z`);

      const spend = parseFloat(row.spend) || 0;
      const impressions = parseInt(row.impressions) || 0;
      const reach = parseInt(row.reach) || 0;
      const clicks = parseInt(row.clicks) || 0;
      const visits = parseInt(row.profileVisits) || 0;
      const leads = parseInt(row.leads) || 0;

      totalSpend += spend;
      totalImpressions += impressions;
      totalClicks += clicks;
      totalVisits += visits;
      totalLeads += leads;

      await prisma.metricaCampanha.upsert({
        where: {
          campanha_id_data: {
            campanha_id: camp.id,
            data: dataInsight
          }
        },
        update: {
          impressoes: impressions,
          alcance: reach,
          cliques: clicks,
          visitas_perfil: visits,
          conversas_leads: leads,
          valor_investido: spend
        },
        create: {
          campanha_id: camp.id,
          data: dataInsight,
          impressoes: impressions,
          alcance: reach,
          cliques: clicks,
          visitas_perfil: visits,
          conversas_leads: leads,
          valor_investido: spend
        }
      });

      upsertedCount++;
    }

    return NextResponse.json({
      success: true,
      message: `${upsertedCount} registros importados com fidelidade 100% para ${dbCliente.nome}!`,
      summary: {
        totalRows: upsertedCount,
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
