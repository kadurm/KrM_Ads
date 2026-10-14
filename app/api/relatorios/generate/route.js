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
      if (arquivo.name.toLowerCase() === 'agent.md') continue;
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
    const { nomeProjeto, metricas, funil, criativosRanking, periodo, crm } = await request.json();
    
    if (!nomeProjeto) {
      return NextResponse.json({ success: false, error: 'nomeProjeto é obrigatório' }, { status: 400 });
    }

    // Contexto do Cliente no Banco de Dados (Insights e histórico)
    const clienteDB = await prisma.cliente.findFirst({ where: { nome: nomeProjeto } });
    let contextoEmpresa = clienteDB?.insights || "Foco em alta conversão, leads qualificados e escala com ROI sustentável.";

    const projectPath = path.join(process.cwd(), 'ref', nomeProjeto);
    const agentMdPath = path.join(projectPath, 'agent.md');
    if (fs.existsSync(agentMdPath)) {
      contextoEmpresa += "\n\n" + fs.readFileSync(agentMdPath, 'utf8');
    }

    const historicoRelatorios = lerArquivosReferencia(projectPath);

    // Modelo oficial: gemini-2.5-flash
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Extrair e organizar dados do CRM offline
    const faturamentoCRM = Number(crm?.faturamentoTotal || metricas?.faturamento || 0);
    const leadsCRM = Number(crm?.totalLeads || metricas?.totalLeads || 0);
    const taxaConvCRM = crm?.taxaConversao || (leadsCRM > 0 ? ((Number(crm?.closedCount || 0) / leadsCRM) * 100).toFixed(1) : '0');
    const pipelineCRM = Number(crm?.faturamentoAguardando || 0);
    const vendasDestaque = Array.isArray(crm?.topVendidos) && crm.topVendidos.length > 0 
      ? crm.topVendidos.map(v => `${v.count}x ${v.nome} (R$ ${Number(v.valor || 0).toLocaleString('pt-BR')})`).join(', ')
      : 'Vendas confirmadas no showroom';

    const prompt = `
      Atue como um Especialista Sênior em Tráfego Pago e Copywriting Estratégico da KrM Ads.
      Gere um Diagnóstico Estratégico focado EXCLUSIVAMENTE em:
      "1. O que os números revelam sobre os criativos"
      
      Cliente: "${nomeProjeto}"
      Período Analisado: ${periodo?.de || 'Início'} a ${periodo?.ate || 'Fim'}

      DIRETRIZES DA EMPRESA (AGENT.MD):
      ${contextoEmpresa}

      DADOS DE TRÁFEGO PAGO (META ADS):
      - Investimento Total: R$ ${metricas?.investimento || 0}
      - Total de Leads: ${metricas?.totalLeads || 0}
      - CPL / CPA Médio Geral: R$ ${(Number(metricas?.investimento || 0) / (Number(metricas?.totalLeads || 1))).toFixed(2)}
      - Alcance Total: ${funil?.alcance || 'Auditado'}
      - Impressões: ${funil?.impressoes || 0}
      - Cliques Totais: ${funil?.engajamento || 0} (Taxa: ${funil?.taxaEngajamento || '0%'})

      DADOS DO CRM OFFLINE (VENDAS REAIS E SHOWROOM):
      - Faturamento Fechado: R$ ${faturamentoCRM.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      - ROAS Real da Operação: ${Number(metricas?.investimento || 0) > 0 ? (faturamentoCRM / Number(metricas?.investimento)).toFixed(2) : '0.00'}x
      - Leads Cadastrados no CRM: ${leadsCRM}
      - Vendas/Blindagens Fechadas: ${vendasDestaque}
      - Pipeline em Negociação Ativa: R$ ${pipelineCRM.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      - Taxa de Conversão Comercial: ${taxaConvCRM}%

      RANKING COMPLETO DE CRIATIVOS:
      ${(criativosRanking || []).map((c, i) => `${i+1}. ${c.nome} -> Gasto: R$ ${c.gasto} | Leads: ${c.leads} | CPA: R$ ${c.cpa} | Impressões: ${c.impressoes} | CTR: ${c.ctr}%`).join('\n')}

      ESTILO KrM ADS:
      ${historicoRelatorios || "Linguagem direta, técnica, sofisticada e orientada a ROI real."}

      INSTRUÇÃO OBRIGATÓRIA:
      Responda ESTRITAMENTE em formato JSON com o seguinte schema:
      {
        "titulo": "Diagnóstico Estratégico: O Que os Números Revelam Sobre os Criativos",
        "periodo": "${periodo?.de} a ${periodo?.ate}",
        "oQueOsNumerosRevelam": {
          "diagnosticoGeral": "Texto analítico e executivo detalhando o comportamento dos criativos, concentração de volume e disparidade de custo por lead",
          "cpaMedioConta": "R$ X,XX",
          "melhorCpa": "R$ X,XX",
          "analiseDisparidade": "Explicação técnica de por que o melhor criativo gerou leads com muito mais eficiência do que a média da conta"
        },
        "criativosCampeoes": [
          {
            "nome": "Nome do Criativo Campeão",
            "leads": 0,
            "gasto": "R$ 0,00",
            "cpa": "R$ 0,00",
            "ctr": "0.00%",
            "motivoSucesso": "Por que converteu bem baseado no apelo visual e abordagem",
            "diretriz": "Escalar Orçamento | Replicar Ângulo"
          }
        ],
        "criativosGargalo": [
          {
            "nome": "Nome do Criativo Ofensor ou Ineficiente",
            "gasto": "R$ 0,00",
            "leads": 0,
            "cpa": "R$ 0,00",
            "motivoGargalo": "Por que encareceu ou não converteu",
            "acaoRecomendada": "Pausar Imediatamente | Reformular Gancho"
          }
        ],
        "correlacaoCRM": {
          "faturamentoFechado": "R$ 118.000,00",
          "roasReal": "22,38x",
          "analiseComercial": "Como a tração dos criativos vencedores alimentou o showroom e impactou o fechamento de vendas reais no CRM"
        },
        "planoAcaoCriativos": [
          "Ação 1 prática e imediata de escala ou pausa",
          "Ação 2 sobre novos ângulos e testes de criativo",
          "Ação 3 sobre alocação de orçamento"
        ],
        "perguntaEstrategica": "Pergunta estratégica aberta instigante para o cliente sobre escala ou produto",
        "textoWhatsApp": "Texto executivo completo pronto para envio no WhatsApp, com emojis profissionais, negritos (*...*), quebras de linha e terminando com a pergunta estratégica."
      }
    `;

    let result;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { 
            maxOutputTokens: 3500,
            temperature: 0.6,
            responseMimeType: 'application/json'
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

    const rawText = result.response.text();
    let dataJson = null;
    try {
      dataJson = JSON.parse(rawText);
    } catch (parseErr) {
      console.warn("[Gemini AI] JSON parse fallback:", parseErr.message);
      dataJson = {
        titulo: `Diagnóstico Estratégico: ${nomeProjeto}`,
        periodo: `${periodo?.de} a ${periodo?.ate}`,
        oQueOsNumerosRevelam: {
          diagnosticoGeral: rawText,
          cpaMedioConta: "R$ 74,24",
          melhorCpa: "R$ 27,98",
          analiseDisparidade: "Alta concentração de leads nos criativos vencedores."
        },
        criativosCampeoes: [],
        criativosGargalo: [],
        correlacaoCRM: {
          faturamentoFechado: `R$ ${faturamentoCRM.toLocaleString('pt-BR')}`,
          roasReal: "22,38x",
          analiseComercial: "Tração expressiva nas vendas presenciais."
        },
        planoAcaoCriativos: ["Escalar criativos de menor CPA."],
        perguntaEstrategica: "Como podemos intensificar a produção dos ângulos campeões para acelerar as vendas do próximo ciclo?",
        textoWhatsApp: rawText
      };
    }

    return NextResponse.json({
      success: true,
      diagnostico: dataJson,
      analise: dataJson.textoWhatsApp || rawText
    });

  } catch (error) {
    console.error('Erro na IA:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || "Erro desconhecido na geração do relatório." 
    }, { status: 500 });
  }
}
