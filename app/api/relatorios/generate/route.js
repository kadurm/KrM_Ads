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
      Atue como um Especialista Sênior em Tráfego Pago e Gestor de Estratégia da KrM Ads. 
      Sua missão é gerar um Diagnóstico Estratégico completo para o cliente "${nomeProjeto}".
      Período analisado: ${periodo?.de || 'N/A'} até ${periodo?.ate || 'N/A'}.

      ═══════════════════════════════════
      DADOS GLOBAIS DO PERÍODO
      ═══════════════════════════════════
      - Investimento Total: R$ ${metricas.investimento}
      - Faturamento Informado: R$ ${metricas.faturamento}
      - Leads/Conversas Totais: ${metricas.totalLeads}
      - CAC Médio: R$ ${(metricas.investimento / (metricas.totalLeads || 1)).toFixed(2)}
      - ROAS: ${(metricas.faturamento / (metricas.investimento || 1)).toFixed(2)}x

      ═══════════════════════════════════
      FUNIL DE JORNADA DO CLIENTE
      ═══════════════════════════════════
      Topo (Impressões): ${funil?.impressoes?.toLocaleString() || 0}
      Meio (Engajamento/Cliques): ${funil?.engajamento?.toLocaleString() || 0} → Taxa: ${funil?.taxaEngajamento || '0%'}
      Fundo (Leads): ${funil?.leads || 0} → Taxa de conversão do engajamento: ${funil?.taxaLeads || '0%'}
      Conversão Final (Compras): ${funil?.conversoes || 0}

      ═══════════════════════════════════
      RANKING DE CRIATIVOS (Ordenado por CPA — menor = melhor)
      ═══════════════════════════════════
      ${criativosRanking?.map((c, i) => `${i+1}. "${c.nome}" → Gasto: R$ ${c.gasto} | Leads: ${c.leads} | CPA: ${c.cpa} | CTR: ${c.ctr}% | Impressões: ${c.impressoes}`).join('\n      ') || 'Nenhum criativo disponível.'}

      ═══════════════════════════════════
      REFERÊNCIAS DE TOM DE VOZ (COPIE RIGOROSAMENTE)
      ═══════════════════════════════════
      ${historicoRelatorios || "Siga um tom profissional, direto, focado em ROI e extremamente estratégico."}

      ═══════════════════════════════════
      INSTRUÇÕES DE GERAÇÃO
      ═══════════════════════════════════
      Gere o relatório exatamente nesta estrutura:

      **1. O QUE ESTÁ ACONTECENDO (Diagnóstico)**
      Explique os números de forma clara e direta. Cite os valores reais. O cliente precisa entender:
      - Quanto investiu e quantos leads gerou
      - Qual é o custo por lead atual
      - Como está o funil: onde está o gargalo? (muita impressão e pouco clique? muito clique e pouco lead?)

      **2. POR QUE ESTÁ ACONTECENDO (Análise do Funil)**
      Explique a lógica do funil de forma educativa:
      - Se a taxa de engajamento está baixa, os criativos não estão capturando atenção
      - Se a taxa de leads está baixa, o público está interessado mas a oferta não converte
      - Relacione os criativos vencedores com o que eles têm de diferente (tipo de conteúdo, abordagem)

      **3. PLANO DE AÇÃO (Baseado nos Criativos Vencedores)**
      Com base no ranking de criativos:
      - Quais criativos devem ser ESCALADOS (aumentar verba)
      - Quais devem ser PAUSADOS (CPA muito alto ou sem resultado)
      - Que TIPO de conteúdo produzir mais (baseado no padrão dos vencedores)
      - Ações concretas para a próxima semana

      REGRA DE OURO (NUNCA QUEBRE): O relatório deve ser finalizado obrigatoriamente com uma pergunta estratégica. 
      Nunca termine com uma afirmação. O vendedor/gestor deve manter o controle da conversa.
    `;

    const result = await model.generateContent(prompt);
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
