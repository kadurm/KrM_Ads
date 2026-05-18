/**
 * DIAGNÓSTICO PROFUNDO: Simulação de resolução de credenciais
 * Simula EXATAMENTE o que o POST /api/meta/sync faz para cada cliente.
 */
const fs = require('fs');
const path = require('path');
// Load .env manually
const envPath = path.join(__dirname, '..', '.env');
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
  const clientes = await prisma.cliente.findMany({ orderBy: { nome: 'asc' } });
  
  console.log('='.repeat(80));
  console.log('  DIAGNÓSTICO PROFUNDO: RESOLUÇÃO DE CREDENCIAIS POR CLIENTE');
  console.log('='.repeat(80));
  console.log(`  Total de clientes no banco: ${clientes.length}\n`);

  for (const c of clientes) {
    const nome = c.nome;
    
    // --- Simula a lógica EXATA do POST /api/meta/sync ---
    const slug = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '');
    const shortName = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, "").split(' ')[0];
    
    const tokenKey_slug_upper = `META_ACCESS_TOKEN_${slug.toUpperCase()}`;
    const tokenKey_slug = `META_ACCESS_TOKEN_${slug}`;
    const tokenKey_short_upper = `META_ACCESS_TOKEN_${shortName.toUpperCase()}`;
    const tokenKey_short = `META_ACCESS_TOKEN_${shortName}`;
    
    const accountKey_slug_upper = `META_AD_ACCOUNT_ID_${slug.toUpperCase()}`;
    const accountKey_slug = `META_AD_ACCOUNT_ID_${slug}`;
    const accountKey_short_upper = `META_AD_ACCOUNT_ID_${shortName.toUpperCase()}`;
    const accountKey_short = `META_AD_ACCOUNT_ID_${shortName}`;
    
    // Resolução real (mesma cadeia de fallback do código)
    const resolvedToken = process.env[tokenKey_slug_upper] || 
                          process.env[tokenKey_slug] ||
                          process.env[tokenKey_short_upper] ||
                          process.env[tokenKey_short] ||
                          process.env['META_ACCESS_TOKEN_GLOBAL'] || 
                          c.meta_access_token;

    const rawAccountId = process.env[accountKey_slug_upper] || 
                         process.env[accountKey_slug] ||
                         process.env[accountKey_short_upper] ||
                         process.env[accountKey_short] ||
                         c.meta_ads_account_id;

    const adAccountId = rawAccountId?.startsWith('act_') ? rawAccountId : (rawAccountId ? `act_${rawAccountId}` : null);
    
    // Qual chave foi encontrada?
    let tokenSource = 'NENHUM';
    if (process.env[tokenKey_slug_upper]) tokenSource = tokenKey_slug_upper;
    else if (process.env[tokenKey_slug]) tokenSource = tokenKey_slug;
    else if (process.env[tokenKey_short_upper]) tokenSource = tokenKey_short_upper;
    else if (process.env[tokenKey_short]) tokenSource = tokenKey_short;
    else if (process.env['META_ACCESS_TOKEN_GLOBAL']) tokenSource = 'META_ACCESS_TOKEN_GLOBAL';
    else if (c.meta_access_token) tokenSource = 'DB (meta_access_token)';
    
    let accountSource = 'NENHUM';
    if (process.env[accountKey_slug_upper]) accountSource = accountKey_slug_upper;
    else if (process.env[accountKey_slug]) accountSource = accountKey_slug;
    else if (process.env[accountKey_short_upper]) accountSource = accountKey_short_upper;
    else if (process.env[accountKey_short]) accountSource = accountKey_short;
    else if (c.meta_ads_account_id) accountSource = 'DB (meta_ads_account_id)';

    // Contagem de métricas no banco
    const metricCount = await prisma.metricaCampanha.count({
      where: { campanha: { cliente_id: c.id } }
    });
    const campCount = await prisma.campanha.count({
      where: { cliente_id: c.id }
    });
    const criativoCount = await prisma.criativo.count({
      where: { campanha: { cliente_id: c.id } }
    });

    // Última métrica
    const lastMetric = await prisma.metricaCampanha.findFirst({
      where: { campanha: { cliente_id: c.id } },
      orderBy: { data: 'desc' }
    });

    // Primeira métrica
    const firstMetric = await prisma.metricaCampanha.findFirst({
      where: { campanha: { cliente_id: c.id } },
      orderBy: { data: 'asc' }
    });

    console.log(`──────────────────────────────────────────────────────────────`);
    console.log(`  CLIENTE: ${nome}`);
    console.log(`  DB ID: ${c.id}`);
    console.log(`  DB Slug: ${c.slug || '(VAZIO - NÃO DEFINIDO)'}`);
    console.log(`  Slug Calculado: "${slug}"`);
    console.log(`  ShortName Calculado: "${shortName}"`);
    console.log(`  ---`);
    console.log(`  TOKEN:`);
    console.log(`    Fonte Resolvida: ${tokenSource}`);
    console.log(`    Token encontrado: ${resolvedToken ? 'SIM (' + resolvedToken.substring(0, 20) + '...)' : '❌ NÃO'}`);
    console.log(`  ACCOUNT ID:`);
    console.log(`    Fonte Resolvida: ${accountSource}`);
    console.log(`    Account ID Final: ${adAccountId || '❌ NÃO ENCONTRADO'}`);
    console.log(`    DB meta_ads_account_id: ${c.meta_ads_account_id || '(vazio)'}`);
    console.log(`  ---`);
    console.log(`  DADOS NO BANCO:`);
    console.log(`    Campanhas: ${campCount}`);
    console.log(`    Criativos: ${criativoCount}`);
    console.log(`    Métricas diárias: ${metricCount}`);
    console.log(`    Primeira métrica: ${firstMetric ? firstMetric.data.toISOString().split('T')[0] : 'N/A'}`);
    console.log(`    Última métrica: ${lastMetric ? lastMetric.data.toISOString().split('T')[0] : 'N/A'}`);
    
    // ALERTAS
    const alerts = [];
    if (!resolvedToken) alerts.push('❌ SEM TOKEN DE ACESSO');
    if (!adAccountId) alerts.push('❌ SEM ACCOUNT ID');
    if (c.slug && c.slug !== slug) alerts.push(`⚠️ SLUG DO DB ("${c.slug}") DIFERE DO SLUG CALCULADO ("${slug}")`);
    if (!c.slug) alerts.push('⚠️ SLUG NÃO DEFINIDO NO BANCO DE DADOS');
    if (accountSource === 'DB (meta_ads_account_id)' && process.env['META_ACCESS_TOKEN_GLOBAL']) {
      alerts.push('⚠️ ACCOUNT ID VEM SOMENTE DO BANCO (não do .env)');
    }
    if (tokenSource === 'META_ACCESS_TOKEN_GLOBAL' && accountSource.startsWith('META_AD_ACCOUNT_ID_')) {
      // Normal - Global token + env account
    }
    if (metricCount === 0) alerts.push('❌ ZERO MÉTRICAS NO BANCO');
    if (campCount === 0) alerts.push('❌ ZERO CAMPANHAS NO BANCO');
    
    if (alerts.length > 0) {
      console.log(`  ALERTAS:`);
      alerts.forEach(a => console.log(`    ${a}`));
    } else {
      console.log(`  ✅ SEM ALERTAS`);
    }
    console.log('');
  }

  // Listar todas as variáveis META_ no .env para cruzar
  console.log('='.repeat(80));
  console.log('  VARIÁVEIS DE AMBIENTE META_* DISPONÍVEIS:');
  console.log('='.repeat(80));
  Object.keys(process.env)
    .filter(k => k.startsWith('META_'))
    .sort()
    .forEach(k => {
      const val = process.env[k];
      console.log(`  ${k} = ${val.length > 30 ? val.substring(0, 30) + '...' : val}`);
    });

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
