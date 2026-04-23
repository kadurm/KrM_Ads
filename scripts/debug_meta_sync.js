const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ACCESS_TOKEN = "EAAYYES5B9UgBRQaRlKc2t7qZB27kqokZBP1EKmFI6Hub7ZBNdZBGN3JoSP6dpZBQ0mufMKo71VZBgh93OdP0lalt1xZCXO8HHNc5avK3p0KhqzXgLv5cNLcXmVZBOZA72etylag2GJRYxZBxe9Sk96YYCGKi1I0wX1NDaEedl70vzyqdSO29B58bxX6rwsEnutt0PcnOa4QSnBYKaB";
const AD_ACCOUNT_ID = "act_861875509414758";

async function debug() {
  console.log('--- DEBUG SYNC REAL-TIME ---');
  
  const fields = 'campaign_id,campaign_name,spend,impressions,actions,action_values,purchase_roas';
  const url = `https://graph.facebook.com/v21.0/${AD_ACCOUNT_ID}/insights?fields=${fields}&level=campaign&time_increment=1&date_preset=today&access_token=${ACCESS_TOKEN}`;

  console.log('Fetching Meta API:', url);
  const res = await fetch(url);
  const data = await res.json();

  if (data.error) {
    console.error('ERRO META:', data.error);
    return;
  }

  console.log('RESPOSTA BRUTA DA META (HOJE):');
  console.dir(data.data, { depth: null });

  if (data.data && data.data.length > 0) {
    for (const item of data.data) {
      console.log(`\nCampanha: ${item.campaign_name} (${item.campaign_id})`);
      console.log(`- Investimento (spend): ${item.spend}`);
      console.log(`- Impressões: ${item.impressions}`);
      
      const leads = item.actions?.filter(a => 
        ['lead', 'onsite_conversion.messaging_first_reply', 'onsite_conversion.messaging_conversation_started_7d'].includes(a.action_type)
      );
      console.log('- Leads/Conversas (Detalhado):', leads);
      
      const totalLeads = leads?.reduce((acc, a) => acc + parseInt(a.value), 0) || 0;
      console.log('- TOTAL LEADS CALCULADO:', totalLeads);
    }
  } else {
    console.log('Nenhum dado retornado para hoje.');
  }
}

debug()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
