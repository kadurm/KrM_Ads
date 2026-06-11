const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

// Carregar .env
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) return;
      const key = trimmed.substring(0, eqIdx).trim();
      let val = trimmed.substring(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    });
  }
} catch (e) {
  console.warn(e.message);
}

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

// Carregar calibração
let campaignCalibrationMap = {};
try {
  const calPath = path.join(__dirname, '..', 'utils', 'campaign_calibration.json');
  if (fs.existsSync(calPath)) {
    campaignCalibrationMap = JSON.parse(fs.readFileSync(calPath, 'utf8'));
  }
} catch (e) {}

function getMetric(actions, type, isValue = false) {
  if (!Array.isArray(actions)) return 0;
  const matches = actions.filter(a => a.action_type === type);
  if (matches.length === 0) return 0;
  return matches.reduce((acc, a) => acc + (isValue ? parseFloat(a.value || 0) : parseInt(a.value || 0, 10)), 0);
}

async function main() {
  const c = await prisma.cliente.findFirst({
    where: { nome: { contains: 'Yuri', mode: 'insensitive' } }
  });
  if (!c) {
    console.log('Cliente Dr. Yuri não encontrado');
    return;
  }

  const token = process.env.META_ACCESS_TOKEN_GLOBAL;
  const accountId = 'act_635037056097163'; // Dr. Yuri Telles
  const since = '2026-05-01';
  const until = '2026-05-31';

  console.log(`📡 Buscando dados diários de Maio da Meta para Dr. Yuri Telles...`);
  const query = new URLSearchParams({
    access_token: token,
    limit: '1000',
    time_range: JSON.stringify({ since, until }),
    fields: 'campaign_id,campaign_name,spend,impressions,reach,inline_link_clicks,outbound_clicks,actions,action_values',
    level: 'campaign',
    time_increment: '1'
  });

  const url = `https://graph.facebook.com/v21.0/${accountId}/insights?${query}`;
  const res = await fetch(url);
  const json = await res.json();
  
  if (!json.data || json.data.length === 0) {
    console.log('Nenhum dado retornado da Meta');
    return;
  }

  console.log(`Processando ${json.data.length} registros...`);

  console.log(`📡 Buscando adsets na Meta para identificar destinos...`);
  const adsetsRes = await fetch(`https://graph.facebook.com/v21.0/${accountId}/adsets?access_token=${token}&fields=campaign_id,destination_type,optimization_goal&limit=1000`);
  const adsetsData = adsetsRes.ok ? await adsetsRes.json() : { data: [] };
  const campaignDestinationMap = new Map();
  if (adsetsData.data) {
    adsetsData.data.forEach(adset => {
      if (adset.campaign_id) {
        const current = campaignDestinationMap.get(String(adset.campaign_id)) || [];
        current.push({
          destination_type: adset.destination_type,
          optimization_goal: adset.optimization_goal
        });
        campaignDestinationMap.set(String(adset.campaign_id), current);
      }
    });
  }

  let updatedCount = 0;

  for (const item of json.data) {
    const dataInsight = new Date(item.date_start + 'T00:00:00.000Z');
    const linkClicks = parseInt(item.inline_link_clicks) || 0;
    const outboundClicks = Array.isArray(item.outbound_clicks) ? item.outbound_clicks.reduce((acc, c) => acc + (parseInt(c.value) || 0), 0) : 0;
    const nativeVisits = getMetric(item.actions, 'onsite_conversion.instagram_profile_visit');

    const isInstagramProfileCampaign = (campaignDestinationMap.get(String(item.campaign_id)) || []).some(
      a => a.destination_type === 'INSTAGRAM_PROFILE' || a.optimization_goal === 'PROFILE_VISIT'
    );

    let totalVisitas = 0;
    const calibrationRate = campaignCalibrationMap[String(item.campaign_id)];
    if (calibrationRate !== undefined) {
      totalVisitas = Math.round(linkClicks * calibrationRate);
    } else if (isInstagramProfileCampaign) {
      totalVisitas = Math.max(0, linkClicks - outboundClicks);
    } else if (nativeVisits > 0) {
      totalVisitas = linkClicks + nativeVisits;
    } else if (outboundClicks > (linkClicks * 0.5)) {
      totalVisitas = Math.abs(linkClicks - outboundClicks);
    } else {
      totalVisitas = linkClicks;
    }

    // Achar a campanha no banco pelo meta_id
    const dbCamp = await prisma.campanha.findUnique({
      where: { meta_id: String(item.campaign_id) }
    });

    if (!dbCamp) {
      console.log(`Campanha ${item.campaign_name} (${item.campaign_id}) não encontrada no banco.`);
      continue;
    }

    // Tentar achar e atualizar a métrica diária
    const dbRecord = await prisma.metricaCampanha.findUnique({
      where: {
        campanha_id_data: {
          campanha_id: dbCamp.id,
          data: dataInsight
        }
      }
    });

    if (dbRecord) {
      console.log(`${item.date_start}: DB Visitas era ${dbRecord.visitas_perfil}, Atualizando para ${totalVisitas}`);
      await prisma.metricaCampanha.update({
        where: { id: dbRecord.id },
        data: {
          visitas_perfil: totalVisitas,
          cliques: linkClicks,
          valor_investido: parseFloat(item.spend) || 0,
          impressoes: parseInt(item.impressions) || 0,
          alcance: parseInt(item.reach) || 0
        }
      });
      updatedCount++;
    } else {
      console.log(`${item.date_start}: Registro não existe no banco, criando...`);
      const isTraffic = (dbCamp.objetivo || '').toUpperCase().includes('TRAFFIC');
      const msgReply = getMetric(item.actions, 'onsite_conversion.messaging_first_reply');
      const msgStarted = getMetric(item.actions, 'onsite_conversion.messaging_conversation_started_7d');
      const standardLead = getMetric(item.actions, 'lead');
      const leadGen = getMetric(item.actions, 'onsite_conversion.lead_grouped');
      const fbContact = getMetric(item.actions, 'contact');
      const leadsVal = isTraffic ? 0 : (Math.max(msgReply, msgStarted) + Math.max(standardLead, leadGen) + fbContact);

      await prisma.metricaCampanha.create({
        data: {
          campanha_id: dbCamp.id,
          data: dataInsight,
          impressoes: parseInt(item.impressions) || 0,
          alcance: parseInt(item.reach) || 0,
          cliques: linkClicks,
          visitas_perfil: totalVisitas,
          seguidores: getMetric(item.actions, 'onsite_conversion.follow') + getMetric(item.actions, 'page_like'),
          valor_investido: parseFloat(item.spend) || 0,
          conversas_leads: leadsVal
        }
      });
      updatedCount++;
    }
  }

  console.log(`✅ Concluído! Atualizados/Criados ${updatedCount} registros.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
