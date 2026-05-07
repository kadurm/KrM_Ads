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
process.env.DATABASE_URL = process.env.DIRECT_URL;

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cliente = await prisma.cliente.findFirst({
    where: { nome: { contains: 'Oratória', mode: 'insensitive' } }
  });

  if (!cliente) {
    console.log('Cliente Oratória Délio Pinheiro não encontrado.');
    return;
  }

  const campanha = await prisma.campanha.findFirst({
    where: {
      cliente_id: cliente.id,
      nome_gerado: { contains: '[03][KrM][Message][Curso 20/21 - Maio]' }
    },
    include: {
      metricas: {
        orderBy: { data: 'desc' },
        take: 1
      }
    }
  });

  if (!campanha) {
    console.log('Campanha não encontrada.');
    // List all campaigns for this client to help find the right name
    const all = await prisma.campanha.findMany({ where: { cliente_id: cliente.id }, select: { nome_gerado: true } });
    console.log('Campanhas disponíveis:', all.map(a => a.nome_gerado));
    return;
  }

  console.log('=== DADOS DA CAMPANHA ===');
  console.log('Nome:', campanha.nome_gerado);
  console.log('Objetivo (DB):', campanha.objetivo);
  
  if (campanha.metricas.length > 0) {
    const m = campanha.metricas[0];
    console.log('Última métrica registrada (Data):', m.data.toISOString().split('T')[0]);
    console.log('Investimento:', m.valor_investido);
    console.log('Leads (conversas_leads):', m.conversas_leads);
    console.log('Compras:', m.compras);
  } else {
    console.log('Nenhuma métrica encontrada no banco para esta campanha.');
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
