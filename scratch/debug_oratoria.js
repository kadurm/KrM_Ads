const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');
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

async function main() {
  const c = await prisma.cliente.findFirst({ where: { nome: 'Oratória Delio Pinheiro' }});
  
  const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN_GLOBAL;
  const AD_ACCOUNT_ID = 'act_1524565725442134';

  const since = '2026-04-18';
  const until = '2026-05-18';
  const tr = JSON.stringify({ since, until });

  // 1. Puxar campanhas direto do Meta
  const url = `https://graph.facebook.com/v21.0/${AD_ACCOUNT_ID}/campaigns?fields=id,name,status&access_token=${ACCESS_TOKEN}`;
  const res = await fetch(url);
  const json = await res.json();
  
  console.log('--- CAMPANHAS NA META ---');
  for (const camp of json.data || []) {
      console.log(`- ${camp.name} (ID: ${camp.id}, Status: ${camp.status})`);
      // Puxar insights dessa campanha
      const iUrl = `https://graph.facebook.com/v21.0/${camp.id}/insights?fields=spend,actions&time_range=${encodeURIComponent(tr)}&access_token=${ACCESS_TOKEN}`;
      const iRes = await fetch(iUrl);
      const iJson = await iRes.json();
      if (iJson.data && iJson.data.length > 0) {
          const spend = iJson.data[0].spend;
          const actions = iJson.data[0].actions || [];
          const msgReply = actions.find(a => a.action_type === 'onsite_conversion.messaging_first_reply');
          const standardLead = actions.find(a => a.action_type === 'lead');
          const leadGen = actions.find(a => a.action_type === 'onsite_conversion.lead_grouped');
          const fbContact = actions.find(a => a.action_type === 'contact');
          const leads = Math.max(parseInt(msgReply?.value || 0), 0) 
                      + Math.max(parseInt(standardLead?.value || 0), parseInt(leadGen?.value || 0)) 
                      + parseInt(fbContact?.value || 0);
          console.log(`  Spend: R$ ${spend} | Leads (Bruto): ${leads}`);
      } else {
          console.log(`  Sem dados no período.`);
      }
  }

  // 2. Puxar campanhas do BD
  console.log('\n--- CAMPANHAS NO BANCO DE DADOS ---');
  const dbCamps = await prisma.campanha.findMany({ where: { cliente_id: c.id }});
  for (const camp of dbCamps) {
      console.log(`- ${camp.nome_gerado} (Meta ID: ${camp.meta_id})`);
      // Totalizar métricas dessa campanha
      const metrics = await prisma.metricaCampanha.aggregate({
          where: { campanha_id: camp.id, data: { gte: new Date(since + 'T00:00:00') } },
          _sum: { valor_investido: true, conversas_leads: true }
      });
      console.log(`  Spend DB: R$ ${metrics._sum.valor_investido} | Leads DB: ${metrics._sum.conversas_leads}`);
  }

  await prisma.$disconnect();
}
main();
