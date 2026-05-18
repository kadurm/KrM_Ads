/**
 * DIAGNÓSTICO PARTE 2: Verificação de dados congelados e comparação com Meta API em tempo real
 */
const fs = require('fs');
const pathMod = require('path');
const envPath = pathMod.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
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
  const today = new Date().toISOString().split('T')[0];
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  
  console.log('='.repeat(80));
  console.log('  DIAGNÓSTICO PARTE 2: DADOS CONGELADOS E VERIFICAÇÃO META API');
  console.log('='.repeat(80));
  console.log(`  Data atual: ${today}`);
  console.log(`  Período de análise: ${since30} → ${today}\n`);

  const clientes = await prisma.cliente.findMany({ orderBy: { nome: 'asc' } });

  for (const c of clientes) {
    const nome = c.nome;
    const slug = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '');
    const shortName = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, "").split(' ')[0];
    
    // Resolve token e account (mesmo fallback do POST)
    const ACCESS_TOKEN = process.env[`META_ACCESS_TOKEN_${slug.toUpperCase()}`] || 
                         process.env[`META_ACCESS_TOKEN_${slug}`] ||
                         process.env[`META_ACCESS_TOKEN_${shortName.toUpperCase()}`] ||
                         process.env[`META_ACCESS_TOKEN_${shortName}`] ||
                         process.env['META_ACCESS_TOKEN_GLOBAL'] || 
                         c.meta_access_token;

    const rawAccountId = process.env[`META_AD_ACCOUNT_ID_${slug.toUpperCase()}`] || 
                         process.env[`META_AD_ACCOUNT_ID_${slug}`] ||
                         process.env[`META_AD_ACCOUNT_ID_${shortName.toUpperCase()}`] ||
                         process.env[`META_AD_ACCOUNT_ID_${shortName}`] ||
                         c.meta_ads_account_id;

    const AD_ACCOUNT_ID = rawAccountId?.startsWith('act_') ? rawAccountId : (rawAccountId ? `act_${rawAccountId}` : null);

    if (!ACCESS_TOKEN || !AD_ACCOUNT_ID) {
      console.log(`──── ${nome}: ❌ SEM CREDENCIAIS ────\n`);
      continue;
    }

    // 1. Métricas do banco para o período
    const dbMetrics = await prisma.metricaCampanha.findMany({
      where: {
        campanha: { cliente_id: c.id },
        data: { gte: new Date(since30 + 'T00:00:00'), lte: new Date(today + 'T23:59:59') }
      },
      include: { campanha: { select: { nome_gerado: true, meta_id: true } } },
      orderBy: { data: 'desc' }
    });

    const dbTotalSpend = dbMetrics.reduce((a, m) => a + Number(m.valor_investido), 0);
    const dbTotalLeads = dbMetrics.reduce((a, m) => a + m.conversas_leads, 0);
    const dbTotalImpressions = dbMetrics.reduce((a, m) => a + m.impressoes, 0);
    const lastDbDate = dbMetrics.length > 0 ? dbMetrics[0].data.toISOString().split('T')[0] : 'N/A';

    // 2. Buscar dados REAIS direto da Meta API (account level)
    let metaSpend = 0, metaImpressions = 0, metaLeads = 0;
    let metaError = null;

    try {
      const tr = JSON.stringify({ since: since30, until: today });
      const url = `https://graph.facebook.com/v21.0/${AD_ACCOUNT_ID}/insights?fields=spend,impressions,actions&time_range=${encodeURIComponent(tr)}&access_token=${ACCESS_TOKEN}`;
      const res = await fetch(url);
      const json = await res.json();
      
      if (json.error) {
        metaError = json.error.message;
      } else if (json.data && json.data[0]) {
        metaSpend = parseFloat(json.data[0].spend || 0);
        metaImpressions = parseInt(json.data[0].impressions || 0);
        if (Array.isArray(json.data[0].actions)) {
          const msgReply = json.data[0].actions.find(a => a.action_type === 'onsite_conversion.messaging_first_reply');
          const msgStarted = json.data[0].actions.find(a => a.action_type === 'onsite_conversion.messaging_conversation_started_7d');
          const standardLead = json.data[0].actions.find(a => a.action_type === 'lead');
          const leadGen = json.data[0].actions.find(a => a.action_type === 'onsite_conversion.lead_grouped');
          const fbContact = json.data[0].actions.find(a => a.action_type === 'contact');
          metaLeads = Math.max(parseInt(msgReply?.value || 0), parseInt(msgStarted?.value || 0)) 
                    + Math.max(parseInt(standardLead?.value || 0), parseInt(leadGen?.value || 0)) 
                    + parseInt(fbContact?.value || 0);
        }
      }
    } catch (e) {
      metaError = e.message;
    }

    // 3. Calcular divergências
    const spendDiff = Math.abs(dbTotalSpend - metaSpend);
    const leadsDiff = Math.abs(dbTotalLeads - metaLeads);
    const impressionsDiff = Math.abs(dbTotalImpressions - metaImpressions);

    console.log(`──────────────────────────────────────────────────────────────`);
    console.log(`  ${nome}`);
    console.log(`  Período: ${since30} → ${today}`);
    console.log(`  Última métrica no DB: ${lastDbDate} ${lastDbDate < today ? `⚠️ (${Math.round((new Date(today) - new Date(lastDbDate)) / 86400000)} dias atrás!)` : '✅'}`);
    
    if (metaError) {
      console.log(`  ❌ ERRO AO CONSULTAR META API: ${metaError}`);
    } else {
      console.log(`  ┌────────────────────┬──────────────┬──────────────┬──────────────┐`);
      console.log(`  │ Métrica            │ Banco (DB)   │ Meta (API)   │ Diferença    │`);
      console.log(`  ├────────────────────┼──────────────┼──────────────┼──────────────┤`);
      console.log(`  │ Investimento (R$)  │ ${String(dbTotalSpend.toFixed(2)).padStart(12)} │ ${String(metaSpend.toFixed(2)).padStart(12)} │ ${spendDiff > 1 ? '❌ ' : '✅ '}${String(spendDiff.toFixed(2)).padStart(9)} │`);
      console.log(`  │ Impressões         │ ${String(dbTotalImpressions).padStart(12)} │ ${String(metaImpressions).padStart(12)} │ ${impressionsDiff > 100 ? '❌ ' : '✅ '}${String(impressionsDiff).padStart(9)} │`);
      console.log(`  │ Leads              │ ${String(dbTotalLeads).padStart(12)} │ ${String(metaLeads).padStart(12)} │ ${leadsDiff > 0 ? '❌ ' : '✅ '}${String(leadsDiff).padStart(9)} │`);
      console.log(`  └────────────────────┴──────────────┴──────────────┴──────────────┘`);
      
      if (spendDiff > 1 || leadsDiff > 0 || impressionsDiff > 100) {
        console.log(`  🔴 DIVERGÊNCIA DETECTADA!`);
        if (lastDbDate < today) {
          console.log(`     CAUSA PROVÁVEL: Dados congelados desde ${lastDbDate}. A sync parou/falhou.`);
        }
      }
    }
    console.log('');
  }

  // Verificar se o cron/auto-sync está realmente executando
  console.log('='.repeat(80));
  console.log('  ANÁLISE DO AUTO-SYNC (FRONTEND → POST)');
  console.log('='.repeat(80));
  console.log(`  O auto-sync do frontend (useEffect em page.jsx) NÃO usa forceFullSync.`);
  console.log(`  Isso ativa a JANELA DESLIZANTE (últimos 5 dias).`);
  console.log(`  Se o último sync ocorreu há mais de 5 dias, os dados ficam CONGELADOS.`);
  console.log(`  O botão "Sincronizar" manual usa forceFullSync: true.`);
  console.log(`  ⚠️ NÃO HÁ CRON JOB AUTOMÁTICO para sincronização periódica!\n`);

  // Verificar a questão do Dr. Yuri — env key "Dr" não bate com "Dr."
  console.log('='.repeat(80));
  console.log('  ANÁLISE DE BUGS DE RESOLUÇÃO DE VARIÁVEIS');
  console.log('='.repeat(80));
  const drName = "Dr. Yuri Telles";
  const drShort = drName.normalize('NFD').replace(/[\u0300-\u036f]/g, "").split(' ')[0];
  console.log(`  Dr. Yuri Telles → shortName = "${drShort}" (contém ponto!)`);
  console.log(`  Variável tentada: META_AD_ACCOUNT_ID_${drShort.toUpperCase()} = META_AD_ACCOUNT_ID_DR.`);
  console.log(`  Variável no .env: META_AD_ACCOUNT_ID_Dr (sem ponto!)`);
  console.log(`  O slug calculado é "dryuritelles" → META_AD_ACCOUNT_ID_DRYURITELLES não existe.`);
  console.log(`  ⚠️ O shortName "Dr." com ponto gera key "META_AD_ACCOUNT_ID_DR." que NÃO casa com "META_AD_ACCOUNT_ID_Dr"`);
  console.log(`  RESULTADO: Account ID vem somente do banco de dados (fallback correto, mas frágil)\n`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
