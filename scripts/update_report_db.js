const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const textoRelatorio = `**Diagnóstico Estratégico KrM Ads - Carretel Aviamentos (11/05/2026 a 10/06/2026)**

**1. O QUE ESTÁ ACONTECENDO**
Investimos R$ 733,88 no Meta Ads, gerando 636 leads com CPA de R$ 1,15. Contudo, o CRM registra 0 leads e R$ 0,00 faturamento. Há uma perda CRÍTICA de 100% dos leads, resultando em ROAS Real de 0,00x. Ótimos resultados de topo de funil estão sendo completamente desperdiçados.

**2. POR QUE ESTÁ ACONTECENDO**
A causa provável é uma falha gravíssima na integração Meta Ads-CRM (webhook, API ou fluxo operacional interno). Isso impede que os leads gerados sequer cheguem ao CRM ou ao time de vendas, criando um "apagão" de dados que paralisa o funil e inviabiliza qualquer conversão ou atribuição de receita.

**3. PLANO DE AÇÃO**
1. **URGENTE:** Auditoria e correção imediata da falha na integração Meta Ads-CRM.
2. Tentativa de recuperação dos leads perdidos, se possível (ex: por download de dados da plataforma).
3. Alinhamento e qualificação do time de vendas para pronto atendimento dos leads, com uso rigoroso e obrigatório do CRM.
4. Implementar monitoramento diário da integração para garantir fluxo contínuo e sem perdas.

Com essa falha crucial corrigida, qual o prazo para reativarmos o funil de vendas e transformarmos esses leads qualificados em faturamento real?`;

async function main() {
  const r = await prisma.relatorio.update({
    where: { id: 'a8c58106-d532-4361-acce-1d2022a9ca61' },
    data: {
      diagnostico_performance: textoRelatorio
    }
  });
  console.log('Relatório atualizado com sucesso no banco de dados!');
  console.log('ID:', r.id);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
