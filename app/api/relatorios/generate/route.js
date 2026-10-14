import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function lerArquivosReferencia(dirPath) {
  let conteudo = '';
  if (!fs.existsSync(dirPath)) return conteudo;
  
  try {
    const arquivos = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const arquivo of arquivos) {
      if (arquivo.name.toLowerCase() === 'agent.md') continue; // evita duplicar agent.md
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

    // Prioridade total para Contexto do Banco de Dados (Insights)
    const clienteDB = await prisma.cliente.findFirst({ where: { nome: nomeProjeto } });
    let contextoEmpresa = clienteDB?.insights || "Focar em ROI e Escala Estratégica.";

    // Busca referências de estilo para o Gemini copiar o tom de voz
    const projectPath = path.join(process.cwd(), 'ref', nomeProjeto);
    
    // Suporte ao agent.md (Contexto da Empresa) como fallback/complemento
    const agentMdPath = path.join(projectPath, 'agent.md');
    if (fs.existsSync(agentMdPath)) {
      contextoEmpresa += "\n\n" + fs.readFileSync(agentMdPath, 'utf8');
    }

    const historicoRelatorios = lerArquivosReferencia(projectPath);

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
      Atue como um Especialista Sênior em Tráfego Pago da KrM Ads. 
      Gere um Diagnóstico Estratégico completo e executivo para o cliente "${nomeProjeto}" (${periodo?.de} a ${periodo?.ate}).

      CONTEXTO ESTRATÉGICO DA EMPRESA (AGENT.MD):
      ${contextoEmpresa}

      DADOS CONSOLIDADOS DO PERÍODO:
      - Investimento: R$ ${metricas.investimento}
      - Faturamento: R$ ${metricas.faturamento}
      - Leads: ${metricas.totalLeads}
      - CAC: R$ ${(metricas.investimento / (metricas.totalLeads || 1)).toFixed(2)}
      - ROAS: ${(metricas.faturamento / (metricas.investimento || 1)).toFixed(2)}x

      FUNIL DE TRÁFEGO:
      - Impressões: ${funil?.impressoes}
      - Cliques: ${funil?.engajamento} (Taxa de Cliques/Engajamento: ${funil?.taxaEngajamento})
      - Leads: ${funil?.leads} (Taxa de Conversão: ${funil?.taxaLeads})
      - Vendas / Compras: ${funil?.conversoes}

      TOP CRIATIVOS (Ranking de Performance):
      ${criativosRanking?.slice(0, 8).map((c, i) => `${i+1}. ${c.nome}: R$ ${c.gasto} gasto, ${c.leads} leads, CPA R$ ${c.cpa}, CTR ${c.ctr}%`).join('\n')}

      ESTILO E TOM DE VOZ:
      ${historicoRelatorios || "Tom sofisticado, analítico, seguro e altamente estratégico."}

      ESTRUTURA DO RELATÓRIO:
      # Diagnóstico Estratégico: ${nomeProjeto} (${periodo?.de} a ${periodo?.ate})

      ### 1. O que os números revelam (Diagnóstico Executivo)
      (Análise direta com foco em ROI, volume de leads e custos de aquisição reais)

      ### 2. Análise de Gargalos e Oportunidades no Funil
      (Identificação dos pontos de fricção ou alavancagem nas etapas de cliques para leads e fechamento)

      ### 3. Plano de Ação Imediato
      (Recomendações táticas para escalar os criativos vencedores e pausar os ineficientes)

      REGRAS OBRIGATÓRIAS:
      - Seja objetivo, analítico e de alto nível executivo (sem clichês ou enrolação).
      - Baseie todas as afirmações estritamente nos números fornecidos acima.
      - Termine OBRIGATORIAMENTE com uma pergunta estratégica aberta para o cliente.
    `;

    console.log("Gerando relatório para:", nomeProjeto);
    console.log("Tamanho do prompt:", prompt.length);

    let result;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { 
            maxOutputTokens: 2500,
            temperature: 0.7
          }
        });
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

    const candidate = result?.response?.candidates?.[0];
    if (candidate?.finishReason) {
      console.log("[Gemini AI] Finish Reason:", candidate.finishReason);
    }

    let analise = '';
    try {
      analise = result.response.text();
    } catch (err) {
      console.warn("[Gemini AI] Falha ao extrair texto direto:", err.message);
      analise = candidate?.content?.parts?.map(p => p.text).filter(Boolean).join('\n') || '';
    }

    if (!analise) {
      throw new Error("O modelo não retornou conteúdo textual para a análise.");
    }

    return NextResponse.json({ success: true, analise });

  } catch (error) {
    console.error('Erro na IA:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || "Erro desconhecido na geração do relatório." 
    }, { status: 500 });
  }
}
