const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://neondb_owner:npg_bj7nW0poFIQJ@ep-fragrant-darkness-b6az2gnl.c-2.sa-east-1.aws.neon.tech/neondb?sslmode=require';
const BACKUP_DIR = path.resolve('backup_supabase_2026-10-13');

// Ordem estrita respeitando foreign keys
const tableOrder = [
  'Usuario',
  'Cliente',
  'HistoricoContexto',
  'ImportacaoPlanilha',
  'Lead',
  'Nota',
  'Agendamento',
  'LeadSolution',
  'Campanha',
  'ConjuntoAnuncio',
  'Criativo',
  'MetricaCampanha',
  'MetricaCriativo',
  'Relatorio',
  'MetodoPagamento',
  'Transacao',
  'NotaFiscal',
  'MetricaContaDiaria',
  'RelatorioConsolidado'
];

async function restore() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('🔗 Conectado ao Neon PostgreSQL para restauração.');

  let totalRestored = 0;

  for (const table of tableOrder) {
    const jsonPath = path.join(BACKUP_DIR, `${table}.json`);
    if (!fs.existsSync(jsonPath)) continue;

    const rows = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    if (!rows || rows.length === 0) {
      console.log(`⏩ ${table}: 0 registros (tabela vazia).`);
      continue;
    }

    process.stdout.write(`Restaurando ${table} (${rows.length} registros)... `);
    
    // Inserção em lotes de 100 para alta performance e segurança
    const batchSize = 100;
    const columns = Object.keys(rows[0]);
    const colList = columns.map(c => `"${c}"`).join(', ');

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      const valuesPlaceholders = [];
      const valuesList = [];
      let paramIndex = 1;

      for (const row of batch) {
        const rowPlaceholders = [];
        for (const col of columns) {
          rowPlaceholders.push(`$${paramIndex++}`);
          let val = row[col];
          // Tratar JSON se necessário
          if (val !== null && typeof val === 'object') {
            val = JSON.stringify(val);
          }
          valuesList.push(val);
        }
        valuesPlaceholders.push(`(${rowPlaceholders.join(', ')})`);
      }

      const sql = `INSERT INTO public."${table}" (${colList}) VALUES ${valuesPlaceholders.join(', ')} ON CONFLICT DO NOTHING;`;
      await client.query(sql, valuesList);
    }

    console.log(`✅ OK!`);
    totalRestored += rows.length;
  }

  console.log(`\n🎉 Restauração concluída com sucesso! Total restaurado: ${totalRestored} registros.`);
  await client.end();
}

restore().catch(err => {
  console.error('❌ Erro na restauração:', err);
  process.exit(1);
});
