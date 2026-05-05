import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(request) {
  try {
    const { cliente, postData } = await request.json();
    
    if (!cliente || !postData) {
      return NextResponse.json({ success: false, error: 'Dados incompletos' }, { status: 400 });
    }

    // Busca contexto estratégico
    const clienteDB = await prisma.cliente.findFirst({ where: { nome: cliente } });
    let contextoEmpresa = clienteDB?.insights || "Focar em ROI e Escala Estratégica.";
    
    // Suporte ao agent.md (Contexto da Empresa) como complemento
    const agentMdPath = path.join(process.cwd(), 'ref', cliente, 'agent.md');
    if (fs.existsSync(agentMdPath)) {
      contextoEmpresa += "\n\n" + fs.readFileSync(agentMdPath, 'utf8');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
      Atue como um Estrategista de Tráfego Sênior da KrM Ads.
      Sua missão é analisar um conteúdo publicado no Instagram do cliente "${cliente}" e recomendar a melhor estratégia de tráfego pago para ele.

      CONTEXTO ESTRATÉGICO DA EMPRESA:
      ${contextoEmpresa}

      DADOS DO POST:
      - Tipo: ${postData.type} (Story, Feed ou Reels)
      - Legenda (Caption): ${postData.caption || 'Sem legenda'}
      - Data: ${postData.timestamp}

      OBJETIVO:
      Avalie se este conteúdo tem potencial para ser transformado em anúncio e em qual etapa do funil ele melhor se encaixa.

      INSTRUÇÕES DE RESPOSTA (RETORNE APENAS JSON):
      Retorne um objeto JSON com os seguintes campos:
      - "etapa_funil": (Topo, Meio ou Fundo)
      - "objetivo_campanha": (Reconhecimento, Tráfego, Engajamento, Cadastros ou Vendas)
      - "justificativa": (Uma explicação curta de por que essa estratégia foi escolhida)
      - "pergunta_estrategica": (Uma pergunta para o gestor de tráfego validar a decisão, conforme a Regra de Ouro KrM)

      REGRAS:
      - Seja direto e profissional.
      - A pergunta estratégica é obrigatória.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    
    // Limpeza de possíveis blocos de código markdown do JSON
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
        const parsed = JSON.parse(text);
        return NextResponse.json({ success: true, analysis: parsed });
    } catch (e) {
        return NextResponse.json({ success: true, raw_analysis: text });
    }

  } catch (error) {
    console.error('Analyze Post IA Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
