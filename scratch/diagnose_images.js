const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== DIAGNÓSTICO COMPLETO DE IMAGENS DOS CRIATIVOS ===\n');

  // 1. Total de criativos no banco
  const total = await prisma.criativo.count();
  const comUrl = await prisma.criativo.count({ where: { url_midia: { not: null } } });
  const semUrl = await prisma.criativo.count({ where: { OR: [{ url_midia: null }, { url_midia: '' }] } });

  console.log(`Total de criativos: ${total}`);
  console.log(`Com URL de mídia: ${comUrl}`);
  console.log(`Sem URL (null ou vazio): ${semUrl}`);
  console.log('');

  // 2. Amostra das URLs existentes - testar se são acessíveis
  const amostra = await prisma.criativo.findMany({
    where: { url_midia: { not: null } },
    select: { id: true, nome_anuncio: true, url_midia: true, meta_ad_id: true },
    take: 10,
    orderBy: { criado_em: 'desc' }
  });

  console.log('--- AMOSTRA DOS 10 CRIATIVOS MAIS RECENTES COM URL ---');
  for (const ad of amostra) {
    const url = ad.url_midia;
    console.log(`\nAnúncio: ${ad.nome_anuncio}`);
    console.log(`  Meta Ad ID: ${ad.meta_ad_id}`);
    console.log(`  URL (primeiros 120 chars): ${url?.substring(0, 120)}`);
    
    // Testar se a URL responde
    if (url) {
      try {
        const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
        const contentType = res.headers.get('content-type');
        console.log(`  Status HTTP: ${res.status} ${res.statusText}`);
        console.log(`  Content-Type: ${contentType}`);
        if (res.status !== 200) {
          console.log(`  ⚠️ URL NÃO ACESSÍVEL! Status ${res.status}`);
        }
      } catch (e) {
        console.log(`  ❌ ERRO ao acessar URL: ${e.message}`);
      }
    }
  }

  // 3. Verificar padrões de URL
  console.log('\n\n--- ANÁLISE DE PADRÕES DE URL ---');
  const todos = await prisma.criativo.findMany({
    where: { url_midia: { not: null } },
    select: { url_midia: true }
  });

  const patterns = {
    fbcdn: 0,
    scontent: 0,
    platform_lookaside: 0,
    other: 0,
    empty_string: 0,
    undefined_str: 0
  };

  for (const ad of todos) {
    const url = ad.url_midia;
    if (!url || url.trim() === '') { patterns.empty_string++; continue; }
    if (url === 'undefined') { patterns.undefined_str++; continue; }
    if (url.includes('fbcdn.net')) patterns.fbcdn++;
    else if (url.includes('scontent')) patterns.scontent++;
    else if (url.includes('platform-lookaside')) patterns.platform_lookaside++;
    else { patterns.other++; console.log(`  URL diferente: ${url.substring(0, 80)}`); }
  }
  
  console.log(`  fbcdn.net: ${patterns.fbcdn}`);
  console.log(`  scontent: ${patterns.scontent}`);
  console.log(`  platform-lookaside: ${patterns.platform_lookaside}`);
  console.log(`  String vazia: ${patterns.empty_string}`);
  console.log(`  String 'undefined': ${patterns.undefined_str}`);
  console.log(`  Outro padrão: ${patterns.other}`);

  // 4. Verificar se criativos com métricas recentes têm URL
  console.log('\n\n--- CRIATIVOS COM MÉTRICAS RECENTES (últimos 30 dias) ---');
  const trintaDiasAtras = new Date();
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

  const recentesComMetrica = await prisma.criativo.findMany({
    where: {
      metricas: {
        some: { data: { gte: trintaDiasAtras } }
      }
    },
    select: { 
      id: true, nome_anuncio: true, url_midia: true, meta_ad_id: true,
      metricas: {
        where: { data: { gte: trintaDiasAtras } },
        select: { impressoes: true, valor_investido: true, data: true },
        orderBy: { data: 'desc' },
        take: 1
      }
    }
  });

  let comUrlRecente = 0;
  let semUrlRecente = 0;
  let urlsQuebradas = 0;

  for (const ad of recentesComMetrica) {
    if (ad.url_midia && ad.url_midia.trim() !== '' && ad.url_midia !== 'undefined') {
      comUrlRecente++;
    } else {
      semUrlRecente++;
      console.log(`  SEM URL: ${ad.nome_anuncio} (MetaID: ${ad.meta_ad_id})`);
    }
  }
  
  console.log(`\nCriativos recentes total: ${recentesComMetrica.length}`);
  console.log(`Com URL: ${comUrlRecente}`);
  console.log(`Sem URL: ${semUrlRecente}`);

  // 5. Testar acessibilidade de URLs dos criativos recentes com URL
  console.log('\n\n--- TESTANDO ACESSIBILIDADE DAS URLs (primeiros 5 recentes) ---');
  const recentesComUrl = recentesComMetrica.filter(a => a.url_midia && a.url_midia.trim() !== '');
  for (const ad of recentesComUrl.slice(0, 5)) {
    try {
      const res = await fetch(ad.url_midia, { method: 'HEAD', redirect: 'follow' });
      const status = res.status;
      if (status !== 200) {
        urlsQuebradas++;
        console.log(`  ⚠️ ${ad.nome_anuncio}: HTTP ${status} - URL EXPIRADA/QUEBRADA`);
        console.log(`     URL: ${ad.url_midia.substring(0, 100)}...`);
      } else {
        console.log(`  ✅ ${ad.nome_anuncio}: HTTP 200 OK`);
      }
    } catch (e) {
      urlsQuebradas++;
      console.log(`  ❌ ${ad.nome_anuncio}: ERRO - ${e.message}`);
    }
  }

  console.log(`\nURLs quebradas nos 5 testados: ${urlsQuebradas}`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
