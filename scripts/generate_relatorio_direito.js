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
    where: { nome: { contains: 'Direito Direto', mode: 'insensitive' } }
  });
  if (!c) {
    console.log('Cliente não encontrado');
    return;
  }

  // Dados reais vs banco da auditoria (Maio/2026)
  const realTrafficVisits = 650;
  const dbTrafficVisits = 737;
  const linkClicks = 737;
  const outboundClicks = 68;

  const totalInvestido = 487.57; // R$ 369.12 + R$ 118.45
  const totalLeads = 14;

  // Carregar Contexto Estratégico
  let contextoEmpresa = c.insights || "Focar em ROI e Escala Estratégica.";
  const agentMdPath = path.join(__dirname, '..', 'ref', 'Direito Direto', 'agent.md');
  if (fs.existsSync(agentMdPath)) {
    contextoEmpresa += "\n\n" + fs.readFileSync(agentMdPath, 'utf8');
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `
    Atue como um Especialista Sênior em Tráfego Pago da KrM Ads.
    Gere um Diagnóstico de Auditoria Comparativa para o cliente "Direito Direto" (Mês de Maio/2026).

    CONTEXTO ESTRATÉGICO DA EMPRESA (AGENT.MD):
    ${contextoEmpresa}

    DADOS COMPARATIVOS DA AUDITORIA DE MAIO/2026:
    - Conta Meta Ads Geral: R$ ${totalInvestido.toFixed(2)} investido, 14 leads comerciais reais gerados (CPA Geral: R$ ${(totalInvestido / totalLeads).toFixed(2)}).
      * Campanha Tráfego/Perfil: R$ 369.12 investido, 737 cliques no link, 68 cliques de saída.
        - Visitas ao Perfil no Banco: 737 (100% fiel à Meta API).
        - Visitas Reais (Instagram App): 650.
        - Drop-off / Taxa de Abandono Real: 11,8% dos usuários que clicaram no link não completaram o carregamento do perfil no aplicativo (Drop-off de 737 cliques para 650 visitas).
      * Campanha de Engajamento/WhatsApp: R$ 118.45 investido, 14 leads reais gerados (CPA da campanha: R$ ${(118.45 / 14).toFixed(2)}).

    ESTRUTURA DO RELATÓRIO:
    1. DIAGNÓSTICO COMPARATIVO (Comparação das visitas ao perfil da campanha de tráfego (737 Cliques/Visitas no banco vs 650 visitas reais no app) e os 14 leads reais gerados na de engajamento).
    2. ANÁLISE DO DROPOFF (Explicar que a diferença de 11,8% se deve à perda de carregamento/abandono no app do Instagram, que é uma taxa de conversão/bounce rate natural de tráfego, mantendo o banco 100% fiel à API Meta).
    3. PLANO DE AÇÃO (Expor o drop-off técnico como comportamento natural de usuário e focar o funil comercial na qualificação rápida dos 14 leads jurídicos pelo WhatsApp).

    REGRAS CRUCIAIS:
    - Tamanho máximo do texto: 1000 caracteres. Seja extremamente conciso e direto.
    - Termine obrigatoriamente com uma pergunta estratégica.
  `;

  console.log("Chamando Gemini...");
  const result = await model.generateContent(prompt);
  const analise = result.response.text();

  console.log("\n--- DIAGNÓSTICO DIRETO GERADO ---\n");
  console.log(analise);
  console.log("\n----------------------------------\n");

  // Salvar no banco de dados
  console.log("Salvando relatório no banco de dados...");
  const relatorio = await prisma.relatorio.create({
    data: {
      cliente_id: c.id,
      diagnostico_performance: analise,
      desenvolvimento_algoritmo: "Auditoria comparativa de Direito Direto para Maio/2026. Identificação de drop-off de visitas ao perfil (abandono natural de 11,8%).",
      proximos_passos: "1. Explicar o drop-off natural de 11.8% no painel como comportamento de usuário (bounce rate). 2. Otimizar a velocidade de carregamento da bio e dos destaques do perfil. 3. Monitorar tempo de resposta do time comercial para os 14 leads no WhatsApp."
    }
  });
  console.log(`Relatório salvo com sucesso no ID: ${relatorio.id}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
