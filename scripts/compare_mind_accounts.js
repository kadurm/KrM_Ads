const ACCESS_TOKEN = "EAAYYES5B9UgBRZAQO71F2EXGKwOkJk8KF1ZBpZBxeW4JMZBSFmo7T11dYZBbBWtD22cDnc1PA6Uc4kMR0HEUzs89wmj2J31rvU5932VMwaM3uRhZBZCfoxwDWaqQuxek4rz8lMQfCDMwokCx7lTzrTXZAzHcBVFc4DZAbY9mbLlavqeh1y4jrZBdjB7eGJJer847iNjMhz9Jno9onxjQQNzYRGsrX9O6evaZBwC0Sv4pum7WMwNMOoVEQZDZD";

async function compareMindAccounts() {
  const mindAccounts = [
    { name: '[00][MindSistema]', id: 'act_2373100163138748' },
    { name: '[01][Mind]', id: 'act_1733388940684899' }
  ];

  console.log('--- COMPARATIVO DE CONTAS MIND ---');

  for (const acc of mindAccounts) {
    console.log(`\nVerificando: ${acc.name} (${acc.id})`);
    
    // 1. Verificar Campanhas (sem filtros de status para ver tudo)
    const campsUrl = `https://graph.facebook.com/v21.0/${acc.id}/campaigns?access_token=${ACCESS_TOKEN}&fields=id,name,status&limit=10`;
    const insightsUrl = `https://graph.facebook.com/v21.0/${acc.id}/insights?access_token=${ACCESS_TOKEN}&date_preset=last_30d&fields=spend,impressions`;

    try {
      const [cRes, iRes] = await Promise.all([fetch(campsUrl), fetch(insightsUrl)]);
      const cData = await cRes.json();
      const iData = await iRes.json();

      console.log(` Campanhas encontradas: ${cData.data?.length || 0}`);
      if (cData.data) cData.data.forEach(c => console.log(`  - ${c.name} (${c.status})`));
      
      const spend = iData.data?.[0]?.spend || '0.00';
      console.log(` Investimento (30d): R$ ${spend}`);
    } catch (e) {
      console.error(` Erro ao verificar ${acc.name}:`, e.message);
    }
  }
}

compareMindAccounts();
