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

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function main() {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const prompt = `
    Atue como um Especialista Sênior em Tráfego Pago da KrM Ads. 
    Gere um Diagnóstico Estratégico em português para o cliente "Carretel Aviamentos" (11/05/2026 a 10/06/2026).

    DADOS DE AUDITORIA DO PERÍODO:
    - Investimento Meta Ads: R$ 733.88
    - Leads Gerados no Meta Ads: 636
    - CPA Médio Meta: R$ 1.15
    - Faturamento Real no CRM: R$ 0.00
    - Leads Registrados no CRM Interno: 0 (Divergência Crítica de 100% de Perda de Leads!)
    - ROAS Real: 0.00x

    ESTRUTURA DO RELATÓRIO:
    1. O QUE ESTÁ ACONTECENDO (Diagnóstico com números reais de tráfego e a disparidade alarmante com o CRM)
    2. POR QUE ESTÁ ACONTECENDO (Explicação sobre o apagão de dados e possíveis falhas no webhook ou fluxo operacional)
    3. PLANO DE AÇÃO (Medidas imediatas para corrigir a integração, recuperar leads e qualificar o time de vendas)

    REGRAS CRUCIAIS:
    - Tamanho máximo do texto: 1000 caracteres. Seja extremamente conciso.
    - Termine obrigatoriamente com uma pergunta estratégica.
  `;

  console.log("Chamando Gemini...");
  const result = await model.generateContent(prompt);
  console.log("Resposta:");
  console.log(result.response.text());
}

main().catch(console.error);
