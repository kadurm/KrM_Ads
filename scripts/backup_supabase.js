const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const url = 'https://osbimptslaojrxzjmmla.supabase.co';
const key = 'sb_publishable_doyukdB5w5sTz6TME0_nIA_b29j8jcM';
const supabase = createClient(url, key);

const tables = [
  'Cliente',
  'Usuario',
  'Campanha',
  'ConjuntoAnuncio',
  'Criativo',
  'MetricaCampanha',
  'MetricaCriativo',
  'Lead',
  'Nota',
  'Agendamento',
  'HistoricoContexto',
  'MetodoPagamento',
  'Transacao',
  'NotaFiscal',
  'MetricaContaDiaria',
  'LeadSolution',
  'RelatorioConsolidado',
  'Relatorio',
  'ImportacaoPlanilha'
];

const BACKUP_DIR = path.resolve('backup_supabase_' + new Date().toISOString().slice(0, 10));

async function fetchAllRows(tableName) {
  let allRows = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(from, to);

    if (error) {
      throw new Error(`Erro ao exportar tabela ${tableName}: ${error.message}`);
    }

    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  return allRows;
}

async function runBackup() {
  console.log(`🚀 Iniciando extração e backup seguro em: ${BACKUP_DIR}`);
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const manifest = {
    exported_at: new Date().toISOString(),
    project_url: url,
    tables: {}
  };

  for (const table of tables) {
    process.stdout.write(`Exportando ${table}... `);
    try {
      const rows = await fetchAllRows(table);
      const filePath = path.join(BACKUP_DIR, `${table}.json`);
      fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), 'utf8');
      manifest.tables[table] = rows.length;
      console.log(`✅ ${rows.length} registros salvos.`);
    } catch (e) {
      console.log(`❌ Erro: ${e.message}`);
      manifest.tables[table] = `ERRO: ${e.message}`;
    }
  }

  fs.writeFileSync(path.join(BACKUP_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  console.log('\n🎉 Backup completo finalizado com sucesso!');
  console.log('Manifesto:', JSON.stringify(manifest.tables, null, 2));
}

runBackup();
