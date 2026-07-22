const { PrismaClient } = require('@prisma/client');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// Carregar .env
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) return;
      const key = trimmed.substring(0, eqIdx).trim();
      let val = trimmed.substring(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    });
  }
} catch (e) {
  console.warn('Erro ao carregar .env:', e.message);
}

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function main() {
  const c = await prisma.cliente.findFirst({
    where: { nome: { contains: 'Solution Place', mode: 'insensitive' } }
  });
  if (!c) {
    console.log('Cliente "Solution Place" não encontrado.');
    return;
  }

  // Dados reais consolidados da auditoria do período de Junho/2026 (01/06 a 17/06)
  const realConsolidado = {
    investimento: 1605.34,
    leadsMeta: 90,
    cplEstavel: 11.58,
    picoCpl: 112.92
  };

  // Carregar Contexto Estratégico do agent.md
  let contextoEmpresa = c.insights || "Focar em ROI e Escala Estratégica.";
  const agentMdPath = path.join(__dirname, '..', 'ref', 'Solution Place', 'agent.md');
  if (fs.existsSync(agentMdPath)) {
    contextoEmpresa += "\n\n" + fs.readFileSync(agentMdPath, 'utf8');
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `
    Atue como um Especialista Sênior em Tráfego Pago da KrM Ads.
    Gere um Diagnóstico de Auditoria Comparativa para o cliente "Solution Place" (Mês de Junho/2026 - Período de 01/06 a 17/06).

    CONTEXTO ESTRATÉGICO DA EMPRESA (AGENT.MD):
    ${contextoEmpresa}

    DADOS COMPARATIVOS DA AUDITORIA DE JUNHO/2026:
    - Conta Meta Ads Geral: R$ ${realConsolidado.investimento.toFixed(2)} investido, ${realConsolidado.leadsMeta} leads comerciais de WhatsApp/Direct gerados (CPA Geral: R$ ${(realConsolidado.investimento / realConsolidado.leadsMeta).toFixed(2)}).
      * Período Estável (01/06 a 11/06): CPL médio de R$ ${realConsolidado.cplEstavel.toFixed(2)}.
      * Período da Estreia do Brasil na Copa do Mundo (12/06 a 17/06):
        - 12/06 (Véspera): CPL subiu para R$ 33,04 (Investimento: R$ 99,13 | 3 Leads).
        - 13/06 (Dia do Jogo de Estreia): CPL atingiu o pico de R$ 112,92 (Investimento: R$ 112,92 | 1 Lead).
        - 14/06: CPL R$ 53,14 (Investimento: R$ 106,28 | 2 Leads).
        - 15/06: CPL R$ 44,39 (Investimento: R$ 133,18 | 3 Leads).
        - 16/06: CPL R$ 65,18 (Investimento: R$ 130,36 | 2 Leads).
        - 17/06: CPL R$ 65,73 (Investimento: R$ 131,46 | 2 Leads).

    ESTRUTURA DO RELATÓRIO:
    1. DIAGNÓSTICO COMPARATIVO (Apresentar os números do período estável vs período da estreia do Brasil na Copa do Mundo, destacando a elevação do CPL médio de R$ 11,58 para R$ 54,87 no período sob influência do evento).
    2. ANÁLISE DA ANOMALIA (Explicar tecnicamente que a estreia da seleção dispersou o foco do público premium de blindagem de alto padrão no Rio de Janeiro, gerando um pico atípico de R$ 112,92 no CPL do dia do jogo).
    3. PLANO DE AÇÃO (Pausar ou reduzir drasticamente o orçamento diário das campanhas nas 24 horas antes e nos dias de partidas da seleção, alocando a verba preservada em janelas de estabilidade comercial).

    REGRAS CRUCIAIS:
    - Tamanho máximo do texto: 1000 caracteres. Seja extremamente conciso e direto.
    - Termine obrigatoriamente com uma pergunta estratégica.
  `;

  console.log("Chamando Gemini (modelo gemini-2.5-flash)...");
  let result;
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    try {
      result = await model.generateContent(prompt);
      break;
    } catch (e) {
      attempts++;
      const isServiceUnavailable = e.message.includes('503') || e.message.includes('Service Unavailable');
      if (isServiceUnavailable && attempts < maxAttempts) {
        console.log(`Tentativa ${attempts} falhou (503). Aguardando para tentar novamente...`);
        await new Promise(resolve => setTimeout(resolve, 3000 * attempts));
        continue;
      }
      throw e;
    }
  }
  const analise = result.response.text();

  console.log("\n--- DIAGNÓSTICO AUDITADO GERADO ---\n");
  console.log(analise);
  console.log("\n------------------------------------\n");

  // Salvar no banco de dados
  console.log("Salvando relatório no banco de dados...");
  const relatorio = await prisma.relatorio.create({
    data: {
      cliente_id: c.id,
      diagnostico_performance: analise,
      desenvolvimento_algoritmo: "Auditoria comparativa de Solution Place para Junho/2026. Identificação de anomalia de CPL gerada pelo impacto atencional da estreia do Brasil na Copa do Mundo.",
      proximos_passos: "1. Reduzir em até 70% o orçamento diário em dias de jogos da seleção na Copa do Mundo. 2. Concentrar o orçamento economizado nos períodos pós-jogo. 3. Monitorar a retomada do CPL saudável de R$ 10,00 a R$ 25,00."
    }
  });
  console.log(`Relatório salvo com sucesso no ID: ${relatorio.id}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
