const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.resolve('backup_supabase_2026-10-13');
const OUTPUT_FILE = path.join(BACKUP_DIR, 'supabase_complete_restore.sql');

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

function escapeSqlValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return val.toString();
  if (typeof val === 'object') {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  }
  return `'${String(val).replace(/'/g, "''")}'`;
}

function generateSql() {
  console.log(`Gerando script de restauração SQL...`);
  let sql = `-- ========================================================\n`;
  sql += `-- KrM Ads: Restauração Completa de Dados (Supabase -> Firebase/Postgres)\n`;
  sql += `-- Gerado em: ${new Date().toISOString()}\n`;
  sql += `-- Total de tabelas: ${tableOrder.length}\n`;
  sql += `-- ========================================================\n\n`;
  sql += `SET statement_timeout = 0;\n`;
  sql += `SET client_encoding = 'UTF8';\n`;
  sql += `SET standard_conforming_strings = on;\n\n`;

  let totalRows = 0;

  for (const table of tableOrder) {
    const jsonPath = path.join(BACKUP_DIR, `${table}.json`);
    if (!fs.existsSync(jsonPath)) continue;

    const rows = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    if (!rows || rows.length === 0) continue;

    sql += `-- Tabela: ${table} (${rows.length} registros)\n`;
    const columns = Object.keys(rows[0]);
    const colList = columns.map(c => `"${c}"`).join(', ');

    for (const row of rows) {
      const valList = columns.map(c => escapeSqlValue(row[c])).join(', ');
      sql += `INSERT INTO public."${table}" (${colList}) VALUES (${valList}) ON CONFLICT DO NOTHING;\n`;
    }
    sql += `\n`;
    totalRows += rows.length;
  }

  fs.writeFileSync(OUTPUT_FILE, sql, 'utf8');
  console.log(`✅ Script SQL gerado com sucesso em: ${OUTPUT_FILE}`);
  console.log(`Total de comandos INSERT gerados: ${totalRows}`);
}

generateSql();
