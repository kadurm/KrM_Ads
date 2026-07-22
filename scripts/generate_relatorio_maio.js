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
  const c = await prisma.cliente.findFirst({ where: { nome: 'Carretel Aviamentos' } });
  if (!c) {
    console.log('Cliente não encontrado');
    return;
  }

  // Dados reais consolidados da auditoria final (Maio/2026)
  const realConsolidado = {
    investimento: 439.20,
    impressoes: 58056,
    alcance: 30824,
    visitasPerfil: 849,
    novosSeguidores: 177,
    seguidoresAoTodo: 240,
    leadsMeta: 3 // 0 na de tráfego, 3 na Shopee (conversas de fato iniciadas)
  };

  // Carregar Contexto Estratégico
  let contextoEmpresa = c.insights || "Focar em ROI e Escala Estratégica.";
  const agentMdPath = path.join(__dirname, '..', 'ref', 'Carretel Aviamentos', 'agent.md');
  if (fs.existsSync(agentMdPath)) {
    contextoEmpresa += "\n\n" + fs.readFileSync(agentMdPath, 'utf8');
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `
    Atue como um Especialista Sênior em Tráfego Pago da KrM Ads.
    Gere um Diagnóstico de Auditoria Comparativa para o cliente "Carretel Aviamentos" (Mês de Maio/2026) com os dados finais corrigidos do banco de dados.

    CONTEXTO ESTRATÉGICO DA EMPRESA (AGENT.MD):
    ${contextoEmpresa}

    DADOS FINAIS SANEADOS (MAIO/2026):
    - Conta Meta Ads Geral: R$ ${realConsolidado.investimento.toFixed(2)} investido, ${realConsolidado.impressoes} impressões, ${realConsolidado.alcance} alcance.
      * Campanha Tráfego/Perfil: R$ 249.39 investido, 40.259 impressões, 846 cliques (gerando 849 visitas reais vs 861 estimadas - desvio de apenas 1,4%). Leads: 0 (foco exclusivo em perfil/seguidores).
      * Campanha Vendas/Shopee: R$ 189.81 investido, 17.797 impressões, 535 cliques. Leads: 3 (excluindo os 216 falsos-positivos de pixel personalizado 'fb_pixel_custom' que foram banidos conforme a regra 5 do sistema).
    - Ganho de Seguidores: 177 novos seguidores conquistados.
    - CRM Interno: 0 leads cadastrados de forma comercial e faturamento de R$ 0,00.

    ESTRUTURA DO RELATÓRIO:
    1. DIAGNÓSTICO COMPARATIVO (Saneamento do banco: redução de leads de tráfego de 122 para 0, e da Shopee de 220 para 3 leads reais. A auditoria resolveu o falso-positivo provocado pelo pixel personalizado 'fb_pixel_custom', que registrava eventos de e-commerce como leads).
    2. ANÁLISE DO CENÁRIO (A campanha Shopee tem foco em vendas diretas e gerou apenas 3 conversas no chat, enquanto o tráfego gerou 177 novos seguidores que visitaram o perfil).
    3. PLANO DE AÇÃO (Implementar abordagem consultiva direta para os 177 novos seguidores no perfil do Instagram e focar na correção do webhook do CRM para garantir que as conversas reais entrem na esteira de atendimento comercial).

    REGRAS CRUCIAIS:
    - Tamanho máximo do texto: 1000 caracteres. Seja extremamente conciso.
    - Termine obrigatoriamente com uma pergunta estratégica.
  `;

  console.log("Chamando Gemini...");
  const result = await model.generateContent(prompt);
  const analise = result.response.text();

  console.log("\n--- DIAGNÓSTICO DEFINITIVO GERADO ---\n");
  console.log(analise);
  console.log("\n-------------------------------------\n");

  // Salvar no banco de dados
  console.log("Salvando relatório no banco de dados...");
  const relatorio = await prisma.relatorio.create({
    data: {
      cliente_id: c.id,
      diagnostico_performance: analise,
      desenvolvimento_algoritmo: "Auditoria comparativa final pós-saneamento de Maio/2026. Ajuste da heurística de leads (remoção de fb_pixel_custom: Shopee reduzida de 220 para 3 leads).",
      proximos_passos: "1. Corrigir o webhook de captação de leads. 2. Cadastrar novos seguidores em fluxos de abordagem. 3. Monitorar canais de tráfego para Shopee."
    }
  });
  console.log(`Relatório salvo com sucesso no ID: ${relatorio.id}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
