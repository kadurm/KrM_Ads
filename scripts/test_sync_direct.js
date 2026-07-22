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

function getMetric(actions, type, isValue = false) {
  if (!Array.isArray(actions)) return 0;
  const matches = actions.filter(a => a.action_type === type);
  if (matches.length === 0) return 0;
  return matches.reduce((acc, a) => acc + (isValue ? parseFloat(a.value || 0) : parseInt(a.value || 0, 10)), 0);
}

async function main() {
  const token = process.env.META_ACCESS_TOKEN_GLOBAL;
  const accountId = 'act_1621561332322856'; // Direito Direto
  const since = '2026-05-12';
  const until = '2026-05-12';

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
  
  const item = json.data[0];
  const linkClicks = parseInt(item.inline_link_clicks) || 0;
  const outboundClicks = Array.isArray(item.outbound_clicks) ? item.outbound_clicks.reduce((acc, c) => acc + (parseInt(c.value) || 0), 0) : 0;
  const nativeVisits = getMetric(item.actions, 'onsite_conversion.instagram_profile_visit');

  let totalVisitas = 0;
  if (nativeVisits > 0) {
    totalVisitas = linkClicks + nativeVisits;
  } else if (outboundClicks > (linkClicks * 0.5)) {
    totalVisitas = Math.abs(linkClicks - outboundClicks);
  } else {
    totalVisitas = linkClicks;
  }

  console.log('calculated totalVisitas:', totalVisitas);

  // Let's check what is in the DB before upsert
  const dbRecordBefore = await prisma.metricaCampanha.findFirst({
    where: {
      campanha: { meta_id: String(item.campaign_id) },
      data: new Date('2026-05-12T00:00:00.000Z')
    }
  });
  console.log('DB before upsert:', dbRecordBefore ? { cliques: dbRecordBefore.cliques, visitas: dbRecordBefore.visitas_perfil } : 'null');

  // Let's run the upsert
  const updated = await prisma.metricaCampanha.upsert({
    where: {
      campanha_id_data: {
        campanha_id: dbRecordBefore.campanha_id,
        data: new Date('2026-05-12T00:00:00.000Z')
      }
    },
    update: {
      visitas_perfil: totalVisitas
    },
    create: {
      campanha_id: dbRecordBefore.campanha_id,
      data: new Date('2026-05-12T00:00:00.000Z'),
      visitas_perfil: totalVisitas
    }
  });

  console.log('DB after upsert:', { cliques: updated.cliques, visitas: updated.visitas_perfil });
}

main().catch(console.error).finally(() => prisma.$disconnect());
