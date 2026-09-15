import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const body = await request.json();
    const { cliente, rows, summary } = body;

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

    // Identificar período de cobertura
    const validDates = rows.map(r => r.date).filter(Boolean);
    const validEndDates = rows.map(r => r.endDate).filter(Boolean);
    const allDates = [...validDates, ...validEndDates].sort();
    
    const periodSince = summary?.periodSince || (allDates.length > 0 ? allDates[0] : new Date().toISOString().split('T')[0]);
    const periodUntil = summary?.periodUntil || (allDates.length > 0 ? allDates[allDates.length - 1] : periodSince);

    const isPeriodConsolidated = summary?.isPeriodConsolidated ?? Boolean(
      periodSince && periodUntil && (periodSince !== periodUntil || validEndDates.length > 0)
    );

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
    const campaignMapByRow = new Map();

    // 1. Mapeamento ou criação das campanhas
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
      campaignMapByRow.set(row, camp);
    }

    // 2. Consolidar métricas do lote importado
    // Se for consolidado de período: agrupa por campanha (uma métrica para o período)
    // Se tiver detalhamento diário: agrupa por (campanha, data)
    const aggregatedMetrics = new Map();
    const importedCampaignIds = new Set();

    for (const row of rows) {
      const camp = campaignMapByRow.get(row);
      importedCampaignIds.add(camp.id);

      const rowDateStr = isPeriodConsolidated ? periodSince : (row.date || periodSince);
      const spend = parseFloat(row.spend) || 0;
      const impressions = parseInt(row.impressions) || 0;
      const reach = parseInt(row.reach) || 0;
      const clicks = parseInt(row.clicks) || 0;
      const visits = parseInt(row.profileVisits) || 0;
      const leads = parseInt(row.leads) || 0;

      const aggKey = `${camp.id}_${rowDateStr}`;
      if (!aggregatedMetrics.has(aggKey)) {
        aggregatedMetrics.set(aggKey, {
          campId: camp.id,
          campName: camp.nome_gerado,
          dateStr: rowDateStr,
          dataInsight: new Date(`${rowDateStr}T00:00:00.000Z`),
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

    // 3. SOBERANIA DO RELATÓRIO OFICIAL:
    // Se for consolidado do período, removemos registros parciais/desatualizados
    // das campanhas importadas dentro do intervalo (periodSince a periodUntil)
    // para NUNCA somar o relatório com parciais antigas.
    if (isPeriodConsolidated && importedCampaignIds.size > 0) {
      const sinceDateObj = new Date(`${periodSince}T00:00:00.000Z`);
      const untilDateObj = new Date(`${periodUntil}T23:59:59.999Z`);

      console.log(`[Meta Import] Aplicando soberania para ${importedCampaignIds.size} campanhas entre ${periodSince} e ${periodUntil}...`);
      await prisma.metricaCampanha.deleteMany({
        where: {
          campanha_id: { in: Array.from(importedCampaignIds) },
          data: {
            gte: sinceDateObj,
            lte: untilDateObj
          }
        }
      });
    }

    // 4. Gravação fiel dos dados consolidados
    let upsertedCount = 0;
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalVisits = 0;
    let totalLeads = 0;
    let totalReach = 0;

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
      totalReach += item.reach;
      totalClicks += item.clicks;
      totalVisits += item.visits;
      totalLeads += item.leads;
    }

    // 5. REGISTRAR O RELATÓRIO EM RelatorioConsolidado (Âncora permanente do cliente)
    try {
      await prisma.relatorioConsolidado.create({
        data: {
          cliente_id: dbCliente.id,
          periodo_inicio: new Date(`${periodSince}T00:00:00.000Z`),
          periodo_fim: new Date(`${periodUntil}T23:59:59.999Z`),
          total_spend: parseFloat(totalSpend.toFixed(2)),
          total_leads: totalLeads,
          total_visitas: totalVisits,
          total_impressoes: BigInt(totalImpressions),
          total_alcance: BigInt(totalReach),
          metadados_json: JSON.stringify({
            campaigns: Array.from(campMap.values()).map(c => ({
              id: c.id,
              meta_id: c.meta_id,
              nome: c.nome_gerado
            })),
            isPeriodConsolidated,
            recordsCount: upsertedCount
          }),
          origem: 'IMPORT_META_ADS'
        }
      });
      console.log(`[Meta Import] RelatorioConsolidado registrado com sucesso para ${dbCliente.nome}!`);
    } catch (relErr) {
      console.warn('[Meta Import] Aviso ao registrar RelatorioConsolidado:', relErr.message);
    }

    return NextResponse.json({
      success: true,
      message: `${upsertedCount} registros consolidados com soberania de dados para ${dbCliente.nome}!`,
      summary: {
        totalRows: rows.length,
        consolidatedRecords: upsertedCount,
        periodSince,
        periodUntil,
        isPeriodConsolidated,
        campaignsCreated,
        totalSpend: parseFloat(totalSpend.toFixed(2)),
        totalImpressions,
        totalReach,
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
