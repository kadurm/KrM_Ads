const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugSync() {
  const cliente = 'Solution Place'; // Example
  const dbCliente = await prisma.cliente.findFirst({ where: { nome: cliente } });
  
  const criativos = await prisma.criativo.findMany({
    where: { campanha: { cliente_id: dbCliente.id } },
    select: { id: true, nome_anuncio: true, url_midia: true }
  });
  
  console.log('Current state of first 5 creatives:');
  console.log(JSON.stringify(criativos.slice(0, 5), null, 2));
  
  process.exit(0);
}

debugSync();
