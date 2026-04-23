import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function lerArquivosReferencia(dirPath) {
  let conteudo = '';
  if (!fs.existsSync(dirPath)) return conteudo;
  
  try {
    const arquivos = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const arquivo of arquivos) {
      const fullPath = path.join(dirPath, arquivo.name);
      if (arquivo.isDirectory()) {
        conteudo += lerArquivosReferencia(fullPath);
      } else if (arquivo.isFile() && (arquivo.name.endsWith('.txt') || arquivo.name.endsWith('.md'))) {
        conteudo += `\n--- Referência de Estilo (${arquivo.name}) ---\n${fs.readFileSync(fullPath, 'utf8')}\n`;
      }
    }
  } catch (e) { console.error("Erro ao ler referências:", e); }
  return conteudo;
}

export async function POST(request) {
  try {
    const { nomeProjeto, metricas, funil, criativosRanking, periodo } = await request.json();
    
    if (!nomeProjeto) {
      return NextResponse.json({ success: false, error: 'nomeProjeto é obrigatório' }, { status: 400 });
    }

    // Busca referências de estilo para o Gemini copiar o tom de voz
    const projectPath = path.join(process.cwd(), 'ref', nomeProjeto);
    const historicoRelatorios = lerArquivosReferencia(projectPath);

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
      Atue como um Especialista Sênior em Tráfego Pago da KrM Ads. 
      Gere um Diagnóstico Estratégico para o cliente "${nomeProjeto}" (${periodo?.de} a ${periodo?.ate}).

      DADOS DO PERÍODO:
      - Investimento: R$ ${metricas.investimento}
      - Faturamento: R$ ${metricas.faturamento}
      - Leads: ${metricas.totalLeads}
      - CAC: R$ ${(metricas.investimento / (metricas.totalLeads || 1)).toFixed(2)}
      - ROAS: ${(metricas.faturamento / (metricas.investimento || 1)).toFixed(2)}x

      FUNIL:
      - Impressões: ${funil?.impressoes}
      - Cliques: ${funil?.engajamento} (Taxa: ${funil?.taxaEngajamento})
      - Leads: ${funil?.leads} (Taxa: ${funil?.taxaLeads})
      - Compras: ${funil?.conversoes}

      CRIATIVOS (Ranking por CPA):
      ${criativosRanking?.map((c, i) => `${i+1}. ${c.nome}: R$ ${c.gasto} gasto, ${c.leads} leads, CPA R$ ${c.cpa}`).join('\n')}

      REFERÊNCIA DE ESTILO:
      ${historicoRelatorios || "Tom profissional, direto e estratégico focado em ROI."}

      ESTRUTURA DO RELATÓRIO:
      1. O QUE ESTÁ ACONTECENDO (Diagnóstico com números reais)
      2. POR QUE ESTÁ ACONTECENDO (Gargalos do funil)
      3. PLANO DE AÇÃO (Escalar ou pausar criativos)

      REGRA: Termine obrigatoriamente com uma pergunta estratégica.
    `;

    console.log("Gerando relatório para:", nomeProjeto);
    console.log("Tamanho do prompt:", prompt.length);

    let result;
    let attempts = 0;
    const maxAttempts = 3;

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

    return NextResponse.json({ success: true, analise });

  } catch (error) {
    console.error('Erro na IA:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || "Erro desconhecido na geração do relatório." 
    }, { status: 500 });
  }
}
