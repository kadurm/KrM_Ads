const fs = require('fs');
const path = require('path');

// Carrega as variáveis do arquivo .env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
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
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const slug = 'solutionplace';
  const cliente = await prisma.cliente.findUnique({ where: { slug } });
  if (!cliente) {
    console.error('Cliente não encontrado.');
    return;
  }

  const token = process.env.META_ACCESS_TOKEN_GLOBAL || cliente.meta_access_token;
  const rawAccountId = process.env.META_AD_ACCOUNT_ID_SOLUTIONPLACE || cliente.meta_ads_account_id;
  const accountId = rawAccountId.startsWith('act_') ? rawAccountId : `act_${rawAccountId}`;

  console.log(`=== Consulta Direta à API da Meta ===`);
  console.log(`Conta de Anúncios: ${accountId}`);
  
  // Período dos últimos 30 dias (06/05/2026 a 04/06/2026)
  const since = '2026-05-06';
  const until = '2026-06-04';
  const time_range = JSON.stringify({ since, until });

  const url = `https://graph.facebook.com/v21.0/${accountId}/insights?access_token=${token}&time_range=${encodeURIComponent(time_range)}&fields=campaign_id,campaign_name,spend,impressions,clicks,actions&level=campaign&limit=500`;

  console.log(`URL da requisição: ${url.substring(0, 100)}...`);
  
  try {
    const response = await fetch(url);
    const result = await response.json();
    
    if (result.error) {
      console.error('Erro retornado pela Meta API:', result.error);
      return;
    }

    const data = result.data || [];
    console.log(`Retornadas ${data.length} campanhas com gastos no período.`);

    let sumSpendMeta = 0;
    data.forEach(item => {
      const spend = parseFloat(item.spend || 0);
      console.log(`- Campanha: ${item.campaign_name} (${item.campaign_id}) | Gasto: R$ ${spend.toFixed(2)}`);
      sumSpendMeta += spend;
    });

    console.log(`\nSoma Total Investido diretamente da Meta API: R$ ${sumSpendMeta.toFixed(2)}`);
  } catch (error) {
    console.error('Erro na requisição:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
