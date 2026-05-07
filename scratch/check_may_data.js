const fs = require('fs');
const path = require('path');
const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) return;
  const key = trimmed.substring(0, eqIdx).trim();
  let val = trimmed.substring(eqIdx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
  process.env[key] = val;
});
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Verificar últimos registros de métricas no banco
  console.log('=== ÚLTIMAS MÉTRICAS NO BANCO (Solution Place) ===');
  const cliente = await prisma.cliente.findFirst({
    where: { nome: { contains: 'Solution', mode: 'insensitive' } }
  });
  console.log('Cliente:', cliente?.nome, '| ID:', cliente?.id);

  const ultimasMetricas = await prisma.metricaCampanha.findMany({
    where: { campanha: { cliente_id: cliente.id } },
    orderBy: { data: 'desc' },
    take: 10,
    include: { campanha: { select: { nome_gerado: true } } }
  });

  console.log('\nÚltimas 10 métricas registradas:');
  ultimasMetricas.forEach(m => {
    console.log(`  ${m.data.toISOString().split('T')[0]} | ${m.campanha.nome_gerado.substring(0, 40)} | R$ ${Number(m.valor_investido).toFixed(2)} | Leads: ${m.conversas_leads}`);
  });

  // 2. Contar métricas de maio
  const maioStart = new Date('2026-05-01T00:00:00.000Z');
  const maioEnd = new Date('2026-05-31T23:59:59.999Z');
  const countMaio = await prisma.metricaCampanha.count({
    where: {
      campanha: { cliente_id: cliente.id },
      data: { gte: maioStart, lte: maioEnd }
    }
  });
  console.log(`\nMétricas de Maio/2026: ${countMaio} registros`);

  // 3. Contar métricas de abril
  const abrilStart = new Date('2026-04-01T00:00:00.000Z');
  const abrilEnd = new Date('2026-04-30T23:59:59.999Z');
  const countAbril = await prisma.metricaCampanha.count({
    where: {
      campanha: { cliente_id: cliente.id },
      data: { gte: abrilStart, lte: abrilEnd }
    }
  });
  console.log(`Métricas de Abril/2026: ${countAbril} registros`);

  // 4. Testar sync direto com Meta API para maio
  console.log('\n=== TESTANDO SYNC COM META API (01/05 a 07/05) ===');
  const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN_GLOBAL;
  const AD_ACCOUNT_ID = 'act_' + cliente.meta_ads_account_id.replace('act_', '');
  
  const since = '2026-05-01';
  const until = '2026-05-07';
  const time_range = JSON.stringify({ since, until });

  const metaUrl = `https://graph.facebook.com/v21.0/${AD_ACCOUNT_ID}/insights?access_token=${ACCESS_TOKEN}&time_range=${encodeURIComponent(time_range)}&fields=campaign_id,campaign_name,spend,impressions,reach,clicks,actions&level=campaign&time_increment=1&limit=500`;
  
  console.log(`Account: ${AD_ACCOUNT_ID}`);
  console.log('Buscando insights de campanha (01/05 - 07/05)...');
  
  const res = await fetch(metaUrl);
  const data = await res.json();
  
  if (data.error) {
    console.log('❌ ERRO:', data.error.message);
  } else {
    const rows = data.data || [];
    console.log(`✅ Retornou ${rows.length} linhas de insight`);
    
    // Agrupar por dia
    const byDay = {};
    rows.forEach(r => {
      const day = r.date_start;
      if (!byDay[day]) byDay[day] = { spend: 0, impressions: 0, campaigns: 0 };
      byDay[day].spend += parseFloat(r.spend || 0);
      byDay[day].impressions += parseInt(r.impressions || 0);
      byDay[day].campaigns++;
    });
    
    console.log('\nResumo por dia:');
    Object.keys(byDay).sort().forEach(day => {
      const d = byDay[day];
      console.log(`  ${day}: R$ ${d.spend.toFixed(2)} | ${d.impressions} impressões | ${d.campaigns} campanhas`);
    });

    // Mostrar primeiras 3 linhas completas
    console.log('\nPrimeiras 3 linhas (detalhes):');
    rows.slice(0, 3).forEach(r => {
      console.log(`  ${r.date_start} | ${r.campaign_name} | R$ ${r.spend} | Imp: ${r.impressions}`);
    });
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
