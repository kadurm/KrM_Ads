/**
 * Script de diagnóstico para validar sincronização Meta Ads
 * Compara dados brutos da API Meta com dados persistidos no banco
 */

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN_Solution;
const META_AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID_Solution || '861875509414758';

const AD_ACCOUNT_ID = `act_${META_AD_ACCOUNT_ID.replace('act_', '')}`;

// Intervalo de datas fixo para comparação
const until = new Date().toISOString().split('T')[0];
const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

console.log('='.repeat(60));
console.log('DIAGNÓSTICO DE SINCRONIZAÇÃO META ADS');
console.log('='.repeat(60));
console.log(`Período: ${since} até ${until}`);
console.log(`Account: ${AD_ACCOUNT_ID}`);
console.log('='.repeat(60));

// Busca dados brutos da API Meta
async function getRawMetaMetrics() {
  const params = new URLSearchParams({
    fields: 'campaign_id,campaign_name,spend,impressions,reach,inline_link_click_ctr,actions,action_values,purchase_roas',
    level: 'campaign',
    limit: '500',
    time_range: JSON.stringify({ since, until }),
    access_token: META_ACCESS_TOKEN,
  });

  const url = `https://graph.facebook.com/v21.0/${AD_ACCOUNT_ID}/insights?${params}`;
  console.log('\n📡 Requisitando API Meta...');

  const res = await fetch(url);
  const data = await res.json();

  if (data.error) {
    throw new Error(`Erro Meta API: ${data.error.message}`);
  }

  return data.data || [];
}

// Compara métricas
function compararMetricas(metaData, dbData) {
  console.log('\n📊 COMPARAÇÃO DE MÉTRICAS POR CAMPANHA');
  console.log('-'.repeat(60));

  const metaMap = new Map(metaData.map(m => [m.campaign_id, m]));
  const dbMap = new Map(dbData.map(m => [m.campanha.meta_id, m]));

  console.log('\n| Campanha | Origem | Impressões | Investido | Leads | Compras | ROAS |');
  console.log('|----------|----------|------------|-----------|-------|---------|------|');

  for (const [metaId, metaRow] of metaMap.entries()) {
    const dbRow = dbMap.get(metaId);
    const nome = metaRow.campaign_name?.substring(0, 25) || metaId;

    // Meta
    const metaLeads = metaRow.actions?.find(a =>
      ['onsite_conversion.messaging_first_reply', 'lead', 'link_click', 'onsite_conversion.messaging_conversation_started_7d'].includes(a.action_type)
    )?.value || 0;
    const metaCompras = metaRow.actions?.find(a => a.action_type === 'purchase')?.value || 0;
    const metaRoas = metaRow.purchase_roas?.find(a => a.action_type === 'purchase')?.value || 0;

    console.log(`| ${nome.padEnd(25)} | META     | ${String(metaRow.impressions || 0).padStart(10)} | ${String(metaRow.spend || 0).padStart(9)} | ${String(metaLeads).padStart(5)} | ${String(metaCompras).padStart(7)} | ${String(metaRoas).padStart(4)} |`);

    // DB
    if (dbRow) {
      console.log(`| ${nome.padEnd(25)} | DB       | ${String(dbRow.impressoes || 0).padStart(10)} | ${String(dbRow.valor_investido || 0).padStart(9)} | ${String(dbRow.conversas_leads || 0).padStart(5)} | ${String(dbRow.compras || 0).padStart(7)} | ${String(dbRow.roas || 0).padStart(4)} |`);

      // Valida divergências
      const diffs = [];
      if (Math.abs((dbRow.impressoes || 0) - (metaRow.impressions || 0)) > 0) diffs.push('impressoes');
      if (Math.abs(parseFloat(dbRow.valor_investido || 0) - parseFloat(metaRow.spend || 0)) > 0.01) diffs.push('spend');
      if ((dbRow.conversas_leads || 0) !== metaLeads) diffs.push('leads');
      if ((dbRow.compras || 0) !== metaCompras) diffs.push('compras');
      if (Math.abs((dbRow.roas || 0) - (metaRoas || 0)) > 0.01) diffs.push('roas');

      if (diffs.length > 0) {
        console.log(`| ${'⚠️ DIVERGÊNCIA: ' + diffs.join(', ').padEnd(22)} |`);
      }
      console.log('|'.padEnd(74, '-') + '|');
    } else {
      console.log(`| ${nome.padEnd(25)} | DB       | ❌ NÃO ENCONTRADA NO BANCO                              |`);
    }
  }
}

// Valida timezone e data
function validarTimezone() {
  console.log('\n\n🕐 VALIDAÇÃO DE TIMEZONE E DATAS');
  console.log('-'.repeat(60));

  const now = new Date();
  const nowISO = now.toISOString();
  const nowLocal = now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  console.log(`Data UTC: ${nowISO}`);
  console.log(`Data São Paulo: ${nowLocal}`);
  console.log(`Since: ${since}`);
  console.log(`Until: ${until}`);
  console.log(`\nProblema identificado: new Date() no POST cria registro com timestamp atual,`);
  console.log(`não com a data do insight da Meta (que pode ser de dias anteriores)`);
}

// Main
async function main() {
  try {
    const metaRaw = await getRawMetaMetrics();
    console.log(`✅ Dados brutos Meta: ${metaRaw.length} campanhas`);

    // Busca dados do banco via API
    console.log('\n📡 Requisitando dados do banco via API...');
    const dbRes = await fetch('https://krmads.vercel.app/api/meta/sync');
    const dbData = await dbRes.json();

    if (!dbData.success) {
      throw new Error(`Erro API local: ${dbData.error}`);
    }

    console.log(`✅ Dados do banco: ${dbData.metrics.length} métricas de campanha`);

    // Compara
    compararMetricas(metaRaw, dbData.metrics);

    // Valida timezone
    validarTimezone();

    console.log('\n' + '='.repeat(60));
    console.log('DIAGNÓSTICO CONCLUÍDO');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    process.exit(1);
  }
}

main();
