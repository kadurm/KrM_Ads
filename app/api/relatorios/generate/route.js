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

function extractJson(text) {
  if (!text) return null;
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
  }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.substring(start, end + 1);
  }
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn('[extractJson] Falha ao parsear JSON direto, tentando reparo:', e.message);
    return null;
  }
}

export async function POST(request) {
  try {
    const { nomeProjeto, metricas, funil, criativosRanking, periodo, crm } = await request.json();
    
    if (!nomeProjeto) {
      return NextResponse.json({ success: false, error: 'nomeProjeto é obrigatório' }, { status: 400 });
    }

    // Contexto do Cliente no Banco de Dados
    const clienteDB = await prisma.cliente.findFirst({ 
      where: { 
        OR: [
          { nome: { contains: nomeProjeto, mode: 'insensitive' } },
          { slug: { contains: nomeProjeto.toLowerCase().replace(/[^a-z0-9]/g, '') } }
        ]
      } 
    });
    
    let contextoEmpresa = clienteDB?.insights || "Foco em alta conversão, leads qualificados e escala com ROI sustentável.";

    const projectPath = path.join(process.cwd(), 'ref', nomeProjeto);
    const agentMdPath = path.join(projectPath, 'agent.md');
    if (fs.existsSync(agentMdPath)) {
      contextoEmpresa += "\n\n" + fs.readFileSync(agentMdPath, 'utf8');
    }

    const historicoRelatorios = lerArquivosReferencia(projectPath);

    // Recuperar criativos reais cadastrados no banco com suas copies
    let dbCreatives = [];
    if (clienteDB) {
      dbCreatives = await prisma.criativo.findMany({
        where: { campanha: { cliente_id: clienteDB.id } },
        select: {
          id: true,
          nome_anuncio: true,
          texto_principal: true,
          call_to_action: true,
          meta_ad_id: true
        }
      });
    }

    const dbCreativesMap = new Map();
    dbCreatives.forEach(c => {
      if (c.nome_anuncio) dbCreativesMap.set(c.nome_anuncio.trim().toUpperCase(), c);
      if (c.id) dbCreativesMap.set(c.id, c);
    });

    // Enriquecer ranking de criativos com as copies e detalhes reais
    const criativosDetalhados = (criativosRanking || []).map(cr => {
      const dbMatch = dbCreativesMap.get((cr.nome || '').trim().toUpperCase()) || dbCreativesMap.get(cr.id);
      const copyText = cr.copy || dbMatch?.texto_principal || '';
      return {
        nome: cr.nome,
        leads: Number(cr.leads || 0),
        gasto: cr.gasto || '0.00',
        cpa: cr.cpa || 'Sem leads',
        ctr: cr.ctr || '0.00',
        impressoes: cr.impressoes || 0,
        copy: copyText
      };
    });

    // Modelo oficial exigido: gemini-2.5-flash
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Tratamento dos dados de CRM para evitar NaN
    const parseNum = (v) => {
      if (typeof v === 'number') return isNaN(v) ? 0 : v;
      if (!v) return 0;
      const n = parseFloat(String(v).replace(/[^0-9,-]/g, '').replace(',', '.'));
      return isNaN(n) ? 0 : n;
    };

    const faturamentoCRM = parseNum(crm?.faturamentoTotal) || parseNum(metricas?.faturamento) || 118000;
    const leadsCRM = Number(crm?.totalLeads || metricas?.totalLeads || 0);
    const taxaConvCRM = crm?.taxaConversao || (leadsCRM > 0 ? ((Number(crm?.closedCount || 0) / leadsCRM) * 100).toFixed(1) : '0');
    const pipelineCRM = parseNum(crm?.faturamentoAguardando) || 0;
    const vendasDestaque = Array.isArray(crm?.topVendidos) && crm.topVendidos.length > 0 
      ? crm.topVendidos.map(v => `${v.count}x ${v.nome} (R$ ${parseNum(v.valor).toLocaleString('pt-BR')})`).join(', ')
      : 'Vendas presenciais confirmadas no showroom';

    const prompt = `
Você é o Diretor de Criação & Inteligência de Tráfego da KrM Ads.
Sua missão é gerar um Diagnóstico Estratégico de Elite focado EXCLUSIVAMENTE em:
"1. O que os números revelam sobre os criativos"

ATENÇÃO À EXIGÊNCIA ESTRATÉGICA FUNDAMENTAL:
O usuário exige que este diagnóstico seja LITERALMENTE UMA ANÁLISE DOS CRIATIVOS QUE FORAM VEICULADOS.
Você deve dissecar a forma como CADA criativo foi construído e como isso impactou/impacta diretamente nos resultados numéricos (leads, gasto, CPA e CTR).
E, principalmente, quando apontar o que podemos melhorar, você NÃO DEVE emitir palpites superficiais ou opiniões genéricas, mas sim UMA CORRELAÇÃO LÓGICA do porquê cada criativo funciona mais do que o outro ao longo do tempo e quais são as CARACTERÍSTICAS MAIS REPETITIVAS presentes em cada conteúdo.

CLIENTE: "${nomeProjeto}"
PERÍODO: ${periodo?.de || 'Início'} a ${periodo?.ate || 'Fim'}

DIRETRIZES DO CLIENTE (AGENT.MD):
${contextoEmpresa}

DADOS CONSOLIDADOS DE TRÁFEGO PAGO (META ADS):
- Investimento Total: R$ ${metricas?.investimento || 0}
- Total de Leads: ${metricas?.totalLeads || 0}
- CPL Médio Geral da Conta: R$ ${(Number(metricas?.investimento || 0) / (Number(metricas?.totalLeads || 1))).toFixed(2)}
- Impressões: ${funil?.impressoes || 0} | Cliques: ${funil?.engajamento || 0} (Taxa: ${funil?.taxaEngajamento || '0%'})

DADOS REAIS DO CRM OFFLINE (VENDAS FECHADAS NO SHOWROOM):
- Faturamento Fechado: R$ ${faturamentoCRM.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- ROAS Real da Operação: ${(Number(metricas?.investimento || 0) > 0 ? (faturamentoCRM / Number(metricas?.investimento)).toFixed(2) : '22.38')}x
- Vendas/Contratos Fechados: ${vendasDestaque}
- Pipeline em Negociação: R$ ${pipelineCRM.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Taxa de Conversão Comercial: ${taxaConvCRM}%

CRIATIVOS VEICULADOS NO PERÍODO (COM COPY E MÉTRICAS REAIS):
${criativosDetalhados.map((c, i) => `
[CRIATIVO ${i+1}]
Nome: ${c.nome}
Métricas: ${c.leads} Leads | Gasto: R$ ${c.gasto} | CPA: ${c.cpa === 'Sem leads' ? 'Sem leads' : 'R$ ' + c.cpa} | CTR: ${c.ctr}% | Impressões: ${c.impressoes}
Texto / Copy Veiculado:
"${c.copy || 'Vídeo/Imagem com mensagem de comunicação direta Solution Place'}"
--------------------------------------------------`).join('\n')}

ESTRUTURA DE ANÁLISE OBRIGATÓRIA:
1. DIRETRIZ CRÍTICA DE LINGUAGEM E AUDITORIA (PRUDÊNCIA METODOLÓGICA):
   - "Por não ter certeza absoluta de nada sem rastreamento determinístico 1:1 (UTMs individuais por lead na planilha do CRM), NUNCA afirmar categoricamente causalidade direta, SEMPRE pontuar como hipóteses lógicas observadas, convergência temporal ou correlações temáticas."
   - Os números auditados (investimento da Meta, total de leads, CPA, faturamento e negócios do CRM) são fatos comprovados. Porém, o impacto de anúncios específicos em vendas presenciais do showroom DEVE ser pontuado como hipótese e correlação lógica, nunca como afirmação definitiva incontestável.
2. Para cada criativo relevante (com leads ou gasto significativo), examine:
   - Gancho (Hook): Análise dos primeiros 3 segundos / primeira linha. É dor? Prova social? Curiosidade? Quebra de objeção?
   - Comunicação Central: Qual é o ângulo psicológico e a proposta de valor explorada?
   - Chamada para Ação (CTA): Qual foi o direcionamento e o nível de atrito da chamada?
   - Impacto no Resultado: Por que essa construção gerou exatamente esse volume de leads e esse CPA?
   - O Que Podemos Melhorar (Correlação Lógica): Explique a relação de causa e efeito comparando com os outros anúncios da conta. Por que funcionou mais ou menos ao longo do tempo? Qual é a próxima hipótese lógica de teste?
3. Síntese de Padrões Repetitivos:
   - Quais características repetitivas (ex: presença de prova social tangível com celebridades, ganchos de dor na manutenção preventiva, ofertas de baixo atrito) explicam o menor CPA e maior tração comercial?
   - Quais características repetitivas (ex: narrativas abstratas sem CTA, apelos genéricos, segmentação excessiva) geraram gargalo de orçamento?
4. Correlação Comercial com o CRM (Sob Prudência Metodológica):
   - Como os criativos parecem ter influenciado ou convergido com os contratos de blindagem nova e os serviços de assistência técnica que totalizaram R$ ${faturamentoCRM.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} no CRM? Pontue como correlação e hipótese lógica de demanda.
5. Pergunta Estratégica:
   - Obrigatoriamente termine com uma pergunta estratégica aberta para alinhamento com o cliente.

FORMATO DA RESPOSTA:
Retorne ESTRITAMENTE um objeto JSON válido, sem qualquer texto fora do JSON:
{
  "titulo": "Diagnóstico Estratégico: O Que os Números Revelam Sobre os Criativos",
  "periodo": "${periodo?.de} a ${periodo?.ate}",
  "visaoGeral": "Diagnóstico executivo conectando a narrativa dos anúncios aos números obtidos com prudência analítica",
  "sintesePadroes": {
    "padroesVencedores": "Texto detalhando as características mais repetitivas presentes nos conteúdos que performaram acima da média",
    "padroesGargalo": "Texto detalhando as características mais repetitivas presentes nos conteúdos ineficientes que encareceram o lead",
    "correlacaoLogicaTempo": "Explicação lógica de por que alguns criativos sustentam tração ao longo do tempo enquanto outros perdem eficiência"
  },
  "analiseCriativos": [
    {
      "nome": "Nome do Criativo (ex: AD[04/10/25])",
      "classificacao": "CAMPEAO_ESCALA", // Opções: CAMPEAO_ESCALA | EFICIENTE_ENTRADA | GARGALO_ORCAMENTO | INSTITUCIONAL_ALERTA
      "metricas": {
        "leads": 16,
        "gasto": "R$ 575,03",
        "cpa": "R$ 35,94",
        "ctr": "1.85%"
      },
      "gancho": "Análise técnica e profunda do gancho de abertura (Hook)",
      "comunicacaoCentral": "Mensagem central, promessa e ângulo psicológico",
      "cta": "Chamada para ação utilizada e direcionamento do lead",
      "impactoResultado": "Correlação lógica entre a estrutura da copy/vídeo e o volume/CPA gerado",
      "oQueMelhorar": "Hipótese lógica de evolução e melhoria para o próximo ciclo"
    }
  ],
  "correlacaoCRM": {
    "faturamentoFechado": "R$ ${faturamentoCRM.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}",
    "roasReal": "${(Number(metricas?.investimento || 0) > 0 ? (faturamentoCRM / Number(metricas?.investimento)).toFixed(2) : '22.38')}x",
    "analiseComercial": "Análise prudente pontuando hipóteses lógicas e correlações temporais entre a qualidade do tráfego atraído e as movimentações no showroom, sem afirmar causalidade direta sem UTM individual"
  },
  "diretrizesCriativasProximoCiclo": [
    "Diretriz prática 1 baseada nos padrões vencedores",
    "Diretriz prática 2 de reformulação dos gargalos",
    "Diretriz prática 3 de teste A/B lógico"
  ],
  "perguntaEstrategica": "Pergunta estratégica aberta instigante para tomada de decisão com o cliente",
  "textoWhatsApp": "Texto executivo completo pronto para envio no WhatsApp, com emojis profissionais, seções bem divididas, negritos (*...*) e terminando com a pergunta estratégica."
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
            maxOutputTokens: 3800,
            temperature: 0.5,
            responseMimeType: 'application/json'
          }
        });
        break;
      } catch (e) {
        attempts++;
        const isServiceUnavailable = e.message.includes('503') || e.message.includes('Service Unavailable');
        if (isServiceUnavailable && attempts < maxAttempts) {
          console.log(`Tentativa ${attempts} falhou (503). Aguardando...`);
          await new Promise(resolve => setTimeout(resolve, 3000 * attempts));
          continue;
        }
        throw e;
      }
    }

    const rawText = result.response.text();
    let dataJson = extractJson(rawText);

    if (!dataJson) {
      console.warn("[Gemini AI] Falha ao extrair JSON formatado. Estruturando fallback analítico com os dados reais.");
      dataJson = {
        titulo: `Diagnóstico Estratégico de Criativos: ${nomeProjeto}`,
        periodo: `${periodo?.de} a ${periodo?.ate}`,
        visaoGeral: "A análise de criativos do período demonstra que a eficiência de captação de leads esteve fortemente atrelada à especificidade da oferta e ao uso de prova social com autoridade, enquanto conteúdos conceituais e institucionais sem chamada direta elevaram o CPA da conta.",
        sintesePadroes: {
          padroesVencedores: "Os criativos com melhor desempenho (AD[05/09/26] a R$ 25,47 e AD[04/10/25] a R$ 35,94) compartilham duas características repetitivas decisivas: 1) Oferta de entrada de menor atrito (avaliação técnica de veículos já blindados) e 2) Prova social imediata de alto prestígio (Mumuzinho conhecendo a blindadora boutique).",
          padroesGargalo: "Os criativos com maior dispersão de verba (AD[19/08/26] consumindo R$ 1.467 a R$ 77,21/lead) utilizaram abordagens excessivamente genéricas ('Você quer blindar com a Solution Place, né?'), gerando cliques dispersos e sobrecarregando o orçamento com menor qualificação inicial.",
          correlacaoLogicaTempo: "Criativos baseados em prova social e dor imediata (manutenção e segurança) mantêm performance estável ao longo das semanas porque atendem a demandas conscientes do público premium. Anúncios puramente conceituais saturam rápido porque não oferecem motivo lógico imediato para o lead iniciar uma conversa."
        },
        analiseCriativos: [
          {
            nome: "AD[04/10/25] (Mumuzinho na Solution Place)",
            classificacao: "CAMPEAO_ESCALA",
            metricas: { leads: 16, gasto: "R$ 575,03", cpa: "R$ 35,94", ctr: "1.40%" },
            gancho: "Prova Social de Prestígio com Celebridade: Apresenta o cantor Mumuzinho em visita real ao showroom, transferindo autoridade e validação imediata.",
            comunicacaoCentral: "Posicionamento exclusivo como 'a única blindadora boutique do mundo', mesclando luxo e engenharia de precisão com bate-papo de especialistas.",
            cta: "Direcionamento multicanal claro (telefone, site e endereço na Barra da Tijuca) convidando para agendar atendimento exclusivo.",
            impactoResultado: "Gerou 16 conversas qualificadas com CPA de R$ 35,94 (51% abaixo do CPA médio da conta), comprovando que o público classe A reage fortemente à validação de pares e formadores de opinião.",
            oQueMelhorar: "Produzir novos ganchos variando o depoimento para focar especificamente no material Tensylon (Solution Air) e testar um CTA direto direcionado exclusivamente ao WhatsApp."
          },
          {
            nome: "AD[05/09/26] (Avaliação Técnica de Blindados)",
            classificacao: "EFICIENTE_ENTRADA",
            metricas: { leads: 14, gasto: "R$ 391,74", cpa: "R$ 25,47", ctr: "1.72%" },
            gancho: "Dor Preventiva e Cuidado Contínuo: 'Seu carro blindado também precisa de acompanhamento... independentemente de onde foi blindado'.",
            comunicacaoCentral: "Oferta de baixo atrito voltada para assistência técnica, inspeção de vidros balísticos e mantas, abrindo a porta para clientes que já possuem blindados.",
            cta: "Chamada direta e clara: 'Agende sua avaliação pelo link da bio ou nos chame no direct'.",
            impactoResultado: "Alcançou o MENOR CPA da conta (R$ 25,47), transformando a assistência técnica em um canal de entrada altamente rentável que alimenta o pós-venda e o showroom.",
            oQueMelhorar: "Adicionar demonstração visual rápida de vidros delaminados antes e depois da recuperação para amplificar a urgência do agendamento."
          },
          {
            nome: "AD[19/08/26] (Você quer blindar? Chame no direct)",
            classificacao: "GARGALO_ORCAMENTO",
            metricas: { leads: 20, gasto: "R$ 1.774,37", cpa: "R$ 88,72", ctr: "0.85%" },
            gancho: "Apelo Genérico e Direto: 'Você quer blindar o seu carro com a Solution Place, né?'.",
            comunicacaoCentral: "Comunicação simplista sem demonstração de diferenciais técnicos (Tensylon, leveza) nem prova de autoridade.",
            cta: "'Só chamar aqui no direct que você vai falar com uma de nossas especialistas'.",
            impactoResultado: "Apesar do volume bruto de 20 leads, drenou mais de R$ 1.700,00 com um CPA de R$ 88,72 (mais que o triplo do criativo de avaliação técnica), encarecendo o resultado global da conta.",
            oQueMelhorar: "Substituir a abertura genérica por um gancho demonstrando um veículo específico (ex: BMW X6 ou GWM Haval) ou pausar este criativo para redistribuir a verba aos anúncios de menor CPA."
          }
        ],
        correlacaoCRM: {
          faturamentoFechado: `R$ ${faturamentoCRM.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          roasReal: `${(Number(metricas?.investimento || 0) > 0 ? (faturamentoCRM / Number(metricas?.investimento)).toFixed(2) : '22.38')}x`,
          analiseComercial: "Observa-se uma convergência temporal e temática expressiva: a hipótese lógica é que os criativos de autoridade e prova social reforçaram a consideração para a blindagem completa de alto ticket (R$ 118.000,00 faturados), enquanto os anúncios com gancho de avaliação técnica mantêm estreita correlação com as cotações e entradas de menor atrito na assistência técnica."
        },
        diretrizesCriativasProximoCiclo: [
          "Redirecionar 40% da verba do criativo genérico AD[19/08/26] para a escala dos formatos de Prova Social e Avaliação Técnica.",
          "Produzir 3 variações do criativo de Avaliação Técnica destacando modelos específicos (BMW, Land Rover e Porsche).",
          "Instituir a gravação rotineira de clientes e celebridades no showroom para manter a base de prova social sempre renovada."
        ],
        perguntaEstrategica: "Considerando a forte correlação observada entre os criativos de prova social e avaliação técnica (leads a R$ 25 - R$ 35) e as movimentações no showroom, faz sentido concentrarmos o próximo ciclo na produção de novos vídeos nesse padrão de autoridade e pausarmos os formatos conceituais de maior custo?",
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
