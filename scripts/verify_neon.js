const { Client } = require('pg');
const connectionString = 'postgresql://neondb_owner:npg_bj7nW0poFIQJ@ep-fragrant-darkness-b6az2gnl.c-2.sa-east-1.aws.neon.tech/neondb?sslmode=require';

const tables = [
  'Cliente', 'Campanha', 'Criativo', 'MetricaCampanha', 'MetricaCriativo',
  'Lead', 'Nota', 'HistoricoContexto', 'Transacao', 'NotaFiscal',
  'MetricaContaDiaria', 'LeadSolution', 'RelatorioConsolidado', 'Relatorio', 'ImportacaoPlanilha'
];

async function verify() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const report = {};
  let total = 0;
  for (const t of tables) {
    const res = await client.query(`SELECT count(*) FROM public."${t}";`);
    const cnt = parseInt(res.rows[0].count);
    report[t] = cnt;
    total += cnt;
  }
  console.log('=== AUDITORIA FINAL DE DADOS NO NEON ===');
  console.log(JSON.stringify(report, null, 2));
  console.log('TOTAL VERIFICADO NO NOVO BANCO:', total, 'de 8537 esperados');
  await client.end();
}
verify().catch(console.error);
