const ACCESS_TOKEN = "EAAYYES5B9UgBRQaRlKc2t7qZB27kqokZBP1EKmFI6Hub7ZBNdZBGN3JoSP6dpZBQ0mufMKo71VZBgh93OdP0lalt1xZCXO8HHNc5avK3p0KhqzXgLv5cNLcXmVZBOZA72etylag2GJRYxZBxe9Sk96YYCGKi1I0wX1NDaEedl70vzyqdSO29B58bxX6rwsEnutt0PcnOa4QSnBYKaB";
const AD_ACCOUNT_ID = 'act_861875509414758';

async function main() {
  // Vamos testar duas janelas de data para ver qual delas bate com R$ 4.907,51
  // Janela A: 2026-05-06 a 2026-06-04 (últimos 30 dias se hoje é 5 de junho UTC mas 4 de junho local)
  // Janela B: 2026-05-05 a 2026-06-04
  // Janela C: 2026-05-06 a 2026-06-05
  
  const ranges = [
    { since: '2026-05-06', until: '2026-06-04' },
    { since: '2026-05-05', until: '2026-06-04' },
    { since: '2026-05-06', until: '2026-06-05' }
  ];

  for (const range of ranges) {
    console.log(`\n======================================================`);
    console.log(`CONSULTANDO META DIRECTAMENTE: ${range.since} até ${range.until}`);
    console.log(`======================================================`);

    const url = `https://graph.facebook.com/v21.0/${AD_ACCOUNT_ID}/insights?level=campaign&time_range=${encodeURIComponent(JSON.stringify(range))}&fields=campaign_name,campaign_id,spend,impressions,clicks,actions&access_token=${ACCESS_TOKEN}&limit=1000`;
    
    try {
      const res = await fetch(url);
      const json = await res.json();
      
      if (json.error) {
        console.error('Erro na Meta API:', json.error.message);
        continue;
      }

      if (!json.data || json.data.length === 0) {
        console.log('Nenhum dado retornado para esta janela.');
        continue;
      }

      let totalSpend = 0;
      let totalImpressions = 0;
      let totalClicks = 0;
      let totalLeads = 0;

      json.data.forEach(camp => {
        const spend = parseFloat(camp.spend || 0);
        const impressions = parseInt(camp.impressions || 0);
        const clicks = parseInt(camp.clicks || 0);
        
        // Leads
        let leads = 0;
        if (camp.actions) {
          const msgReply = getMetric(camp.actions, 'onsite_conversion.messaging_first_reply');
          const msgStarted = getMetric(camp.actions, 'onsite_conversion.messaging_conversation_started_7d');
          const standardLead = getMetric(camp.actions, 'lead');
          const leadGen = getMetric(camp.actions, 'onsite_conversion.lead_grouped');
          const fbContact = getMetric(camp.actions, 'contact');
          const customPixel = getMetric(camp.actions, 'offsite_conversion.fb_pixel_custom');
          
          leads = Math.max(msgReply, msgStarted) + Math.max(standardLead, leadGen) + fbContact + customPixel;
        }

        totalSpend += spend;
        totalImpressions += impressions;
        totalClicks += clicks;
        totalLeads += leads;

        console.log(`- Campanha: "${camp.campaign_name}" | ID: ${camp.campaign_id} | Gasto: R$ ${spend.toFixed(2)} | Leads: ${leads} | Clicks: ${clicks}`);
      });

      console.log(`\nRESUMO DA JANELA:`);
      console.log(`Total Investido: R$ ${totalSpend.toFixed(2)}`);
      console.log(`Total Impressões: ${totalImpressions}`);
      console.log(`Total Cliques: ${totalClicks}`);
      console.log(`Total Leads (True Leads): ${totalLeads}`);
      console.log(`CPL Médio: R$ ${(totalSpend / (totalLeads || 1)).toFixed(2)}`);
    } catch (err) {
      console.error('Erro na requisição:', err.message);
    }
  }
}

function getMetric(actions, type) {
  if (!Array.isArray(actions)) return 0;
  const match = actions.find(a => a.action_type === type);
  return match ? parseInt(match.value || 0, 10) : 0;
}

main();
