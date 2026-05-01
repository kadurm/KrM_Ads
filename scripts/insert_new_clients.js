const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const clients = [
  { nome: 'Carretel Aviamentos', accountId: '487189220271716' },
  { nome: 'Direito Direto', accountId: '1621561332322856' },
  { nome: 'Mind Gestão Empresarial', accountId: '2373100163138748' },
  { nome: 'Oratória Delio Pinheiro', accountId: '1524565725442134' },
  { nome: 'Cepel Arte Decore', accountId: '1226357518994525' }
];

async function main() {
  console.log('Iniciando inserção de novos clientes no Banco de Dados...');
  
  for (const client of clients) {
    const slug = client.nome.toLowerCase().replace(/ /g, '');
    const exists = await prisma.cliente.findFirst({ where: { nome: client.nome } });
    
    if (!exists) {
      await prisma.cliente.create({
        data: {
          nome: client.nome,
          slug: slug,
          meta_ads_account_id: client.accountId,
          meta_access_token: '', // Usará o Global do .env
          meta_pixel_id: '',
          setor: 'Geral',
          insights: `# Contexto Estratégico: ${client.nome}\nAguardando primeiro ciclo de Deep Learning.`
        }
      });
      console.log(`✅ Cliente criado: ${client.nome}`);
    } else {
      console.log(`ℹ️ Cliente já existe: ${client.nome}`);
    }
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
