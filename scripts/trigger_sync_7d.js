
const cliente = 'Solution Place';
const today = new Date('2026-04-25');
const sevenDaysAgo = new Date('2026-04-18');
const since = sevenDaysAgo.toISOString().split('T')[0];
const until = today.toISOString().split('T')[0];

console.log(`🚀 Iniciando Sync para ${cliente} (${since} até ${until})...`);

fetch('http://localhost:3000/api/meta/sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ cliente, since, until })
})
.then(res => res.json())
.then(data => {
  console.log('✅ Resultado:', data);
  process.exit(0);
})
.catch(err => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
