import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * CRON JOB: Sincronização Automática de Dados Meta Ads
 * Roda diariamente para garantir que os dados de TODOS os clientes estejam atualizados,
 * independentemente de o dashboard ter sido acessado ou não.
 * 
 * Schedule: Todos os dias às 06:00 UTC (03:00 BRT)
 */
export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET || 'KRM_ADS_DEEP_LEARNING_2026'}`;

    if (authHeader !== expectedAuth) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    console.log('[CronSync] Iniciando sincronização automática de todos os clientes...');

    const clientes = await prisma.cliente.findMany({ orderBy: { nome: 'asc' } });
    const results = [];

    // Período: últimos 7 dias até hoje (cobre atribuição atrasada da Meta)
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

    for (const cliente of clientes) {
      try {
        // Monta a URL interna do POST /api/meta/sync
        const baseUrl = process.env.VERCEL_URL 
          ? `https://${process.env.VERCEL_URL}` 
          : process.env.NEXTAUTH_URL || 'http://localhost:3000';
        
        const res = await fetch(`${baseUrl}/api/meta/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            since: sevenDaysAgo,
            until: today,
            cliente: cliente.nome,
            forceFullSync: true
          })
        });

        const data = await res.json();
        
        if (data.success) {
          console.log(`[CronSync] ✅ ${cliente.nome}: Sincronizado com sucesso`);
          results.push({ cliente: cliente.nome, status: 'OK' });
        } else {
          console.error(`[CronSync] ❌ ${cliente.nome}: ${data.error}`);
          results.push({ cliente: cliente.nome, status: 'ERRO', error: data.error });
        }
      } catch (e) {
        console.error(`[CronSync] ❌ ${cliente.nome}: ${e.message}`);
        results.push({ cliente: cliente.nome, status: 'ERRO', error: e.message });
      }
    }

    const successCount = results.filter(r => r.status === 'OK').length;
    const errorCount = results.filter(r => r.status === 'ERRO').length;

    console.log(`[CronSync] Concluído. ${successCount} OK, ${errorCount} Erros.`);

    return NextResponse.json({ 
      success: true, 
      summary: { total: clientes.length, ok: successCount, errors: errorCount },
      results 
    });

  } catch (error) {
    console.error('[CronSync Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
