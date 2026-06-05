const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const since = new Date('2026-05-06T00:00:00Z');
  const until = new Date('2026-06-05T23:59:59Z');

  const slug = 'solutionplace';
  const cliente = await prisma.cliente.findUnique({
    where: { slug },
    include: {
      campanhas: {
        include: {
          metricas: {
            where: {
              data: {
                gte: since,
                lte: until
              }
            }
          }
        }
      }
    }
  });

  console.log(`=== SPEND POR CAMPANHA DE ${since.toISOString().split('T')[0]} A ${until.toISOString().split('T')[0]} ===`);
  
  let grandTotal = 0;
  
  cliente.campanhas.forEach(camp => {
    let campSpend = 0;
    camp.metricas.forEach(m => {
      campSpend += Number(m.valor_investido || 0);
    });
    grandTotal += campSpend;
    if (campSpend > 0) {
      console.log(`- Campanha: "${camp.nome_gerado}" | ID Meta: ${camp.meta_id} | Spend: R$ ${campSpend.toFixed(2)} (${camp.metricas.length} dias com métricas)`);
    }
  });

  console.log(`\nSoma Total: R$ ${grandTotal.toFixed(2)}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
