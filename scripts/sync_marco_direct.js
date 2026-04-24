
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function syncDirect() {
  const cliente = 'Solution Place';
  const since = '2026-03-01';
  const until = '2026-03-31';

  const token = 'EAAYYES5B9UgBRQaRlKc2t7qZB27kqokZBP1EKmFI6Hub7ZBNdZBGN3JoSP6dpZBQ0mufMKo71VZBgh93OdP0lalt1xZCXO8HHNc5avK3p0KhqzXgLv5cNLcXmVZBOZA72etylag2GJRYxZBxe9Sk96YYCGKi1I0wX1NDaEedl70vzyqdSO29B58bxX6rwsEnutt0PcnOa4QSnBYKaB';
  const adAccountId = 'act_861875509414758';

  console.log(`🚀 Iniciando Sincronização direta de ${cliente} para Março...`);

  const url = `https://graph.facebook.com/v21.0/${adAccountId}/insights?fields=campaign_id,campaign_name,spend,impressions,reach,clicks,actions&level=campaign&time_range={"since":"${since}","until":"${until}"}&time_increment=1&access_token=${token}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.error) {
    console.error('Erro Meta:', data.error);
    return;
  }

  const dbCliente = await prisma.cliente.findFirst({ where: { nome: cliente } });
  
  function getMetric(actions, type) {
    if (!Array.isArray(actions)) return 0;
    const matches = actions.filter(a => a.action_type === type);
    return matches.reduce((acc, a) => acc + parseInt(a.value || 0, 10), 0);
  }

  for (const item of data.data) {
    if (!item.campaign_name.includes('[05]')) continue;

    const dataInsight = new Date(item.date_start + 'T00:00:00.000Z');
    
    // Lógica atualizada: Preferir instagram_profile_visit
    const realVisits = getMetric(item.actions, 'onsite_conversion.instagram_profile_visit');
    const linkClicks = getMetric(item.actions, 'link_click');
    const finalVisits = realVisits || linkClicks;

    console.log(`Data: ${item.date_start} | Profile Visits: ${realVisits} | Link Clicks: ${linkClicks} | Final: ${finalVisits}`);

    const camp = await prisma.campanha.findFirst({ where: { meta_id: String(item.campaign_id) } });
    if (camp) {
      await prisma.metricaCampanha.upsert({
        where: { campanha_id_data: { campanha_id: camp.id, data: dataInsight } },
        update: { visitas_perfil: finalVisits },
        create: { campanha_id: camp.id, data: dataInsight, visitas_perfil: finalVisits, impressoes: 0, alcance: 0, cliques: 0, seguidores: 0, valor_investido: 0, conversas_leads: 0 }
      });
    }
  }

  // Verificação Final
  const camp05 = await prisma.campanha.findFirst({
    where: { 
      cliente_id: dbCliente.id,
      nome_gerado: { contains: '[05]' }
    },
    include: {
      metricas: {
        where: {
          data: {
            gte: new Date(since + 'T00:00:00.000Z'),
            lte: new Date(until + 'T23:59:59.999Z')
          }
        }
      }
    }
  });

  const totalVisitas = camp05.metricas.reduce((acc, m) => acc + m.visitas_perfil, 0);
  console.log(`\n📊 TOTAL DE VISITAS NO BANCO (MARÇO): ${totalVisitas}`);
}

syncDirect().then(() => process.exit(0));
