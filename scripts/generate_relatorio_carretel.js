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

  // 1. Coleta de dados reais consolidados para o período (11/05/2026 a 10/06/2026)
  const investimento = 733.88;
  const faturamento = 0.00; // faturamento real no CRM
  const totalLeadsMeta = 636;
  const totalLeadsCRM = 0; // leads inseridos no CRM

  const funil = {
    impressoes: 93266,
    cliques: 2256,
    taxaEngajamento: "2.42%",
    leads: 636,
    taxaLeads: "28.19%",
    conversoes: 0
  };

  const criativosRanking = [
    { nome: '[AD][19/09/25]', gasto: 7.68, leads: 14, cpa: 0.55 },
    { nome: 'AD[05/05/26]', gasto: 379.62, leads: 440, cpa: 0.86 },
    { nome: '[AD][04/03/26]', gasto: 39.80, leads: 36, cpa: 1.11 },
    { nome: '[AD][05/05/26]', gasto: 138.86, leads: 110, cpa: 1.26 },
    { nome: '[AD][06/03/26]', gasto: 165.94, leads: 36, cpa: 4.61 }
  ];

  // 2. Montar Contexto Estratégico (insights + agent.md)
  let contextoEmpresa = c.insights || "Focar em ROI e Escala Estratégica.";
  const agentMdPath = path.join(__dirname, '..', 'ref', 'Carretel Aviamentos', 'agent.md');
  if (fs.existsSync(agentMdPath)) {
    contextoEmpresa += "\n\n" + fs.readFileSync(agentMdPath, 'utf8');
  }

  // 3. Montar Prompt seguindo a regra
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `
    Atue como um Especialista Sênior em Tráfego Pago da KrM Ads. 
    Gere um Diagnóstico Estratégico para o cliente "Carretel Aviamentos" (11/05/2026 a 10/06/2026).

    CONTEXTO ESTRATÉGICO DA EMPRESA (AGENT.MD):
    ${contextoEmpresa}

    DADOS DE AUDITORIA DO PERÍODO:
    - Investimento Meta Ads: R$ ${investimento.toFixed(2)}
    - Leads Gerados no Meta Ads: ${totalLeadsMeta}
    - CPA Médio Meta: R$ ${(investimento / totalLeadsMeta).toFixed(2)}
    - Faturamento Real no CRM: R$ ${faturamento.toFixed(2)}
    - Leads Registrados no CRM Interno: ${totalLeadsCRM} (Divergência Crítica de 100% de Perda de Leads!)
    - ROAS Real: 0.00x

    FUNIL META ADS:
    - Impressões: ${funil.impressoes}
    - Cliques: ${funil.cliques} (Taxa/CTR: ${funil.taxaEngajamento})
    - Leads Meta: ${funil.leads} (Taxa Conversão Cliques -> Leads: ${funil.taxaLeads})
    - Compras/Conversões: ${funil.conversoes}

    CRIATIVOS (Ranking por CPA):
    ${criativosRanking.map((c, i) => `${i+1}. ${c.nome}: R$ ${c.gasto} gasto, ${c.leads} leads, CPA R$ ${c.cpa}`).join('\n')}

    ESTRUTURA DO RELATÓRIO:
    1. O QUE ESTÁ ACONTECENDO (Diagnóstico com números reais de tráfego e a disparidade alarmante com o CRM)
    2. POR QUE ESTÁ ACONTECENDO (Explicação sobre o apagão de dados e possíveis falhas no webhook ou fluxo operacional)
    3. PLANO DE AÇÃO (Medidas imediatas para corrigir a integração, recuperar leads e qualificar o time de vendas)

    REGRAS CRUCIAIS:
    - Tamanho máximo do texto: 1000 caracteres. Seja extremamente conciso e direto ao ponto.
    - Termine obrigatoriamente com uma pergunta estratégica.
  `;

  console.log("Chamando Gemini para gerar o relatório...");
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 450 }
  });

  const analise = result.response.text();
  console.log("\n--- DIAGNÓSTICO GERADO PELO GEMINI ---\n");
  console.log(analise);
  console.log("\n---------------------------------------\n");

  // 4. Salvar na Tabela Relatorio no Banco
  console.log("Salvando relatório no banco de dados...");
  const relatorio = await prisma.relatorio.create({
    data: {
      cliente_id: c.id,
      diagnostico_performance: analise,
      desenvolvimento_algoritmo: "Auditoria de divergência de dados entre Meta Ads Graph API e CRM interno (apagão de leads).",
      proximos_passos: "1. Corrigir o webhook de integração de leads. 2. Implementar fluxo de verificação diária. 3. Treinar equipe comercial para registrar vendas no CRM."
    }
  });
  console.log(`Relatório salvo com sucesso no ID: ${relatorio.id}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
