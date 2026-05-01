import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(request) {
  try {
    const { cliente, creativeData } = await request.json();
    
    if (!cliente || !creativeData) {
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
      Atue como um Diretor de Criação Sênior da KrM Ads especializado em anúncios de alta conversão.
      O cliente é "${cliente}".

      CONTEXTO ESTRATÉGICO DA EMPRESA:
      ${contextoEmpresa}

      DADOS DO CRIATIVO CAMPEÃO (A SER MODELADO):
      - Nome: ${creativeData.nome_anuncio}
      - Copy Original: ${creativeData.texto_principal || 'Não informada'}
      - CTR: ${creativeData.ctr?.toFixed(2)}%
      - Hook Rate (p25): ${creativeData.hook_rate?.toFixed(2)}%
      - Investimento: R$ ${creativeData.valor_investido}
      - Resultados: ${creativeData.leads || creativeData.compras || 0} leads/vendas

      OBJETIVO:
      Analise o porquê deste anúncio ter funcionado tão bem e gere 3 novas variações estratégicas (BRIEFINGS) para a equipe de design e copywriting.
      Cada variação deve atacar um ângulo diferente:
      1. Variação de Gancho (Hook): Mudar os primeiros 3 segundos do vídeo ou a primeira linha do texto.
      2. Variação de Prova Social ou Urgência: Reforçar a autoridade.
      3. Variação de Storytelling: Criar uma narrativa curta.

      REGRAS CRUCIAS:
      - Cada briefing deve conter: [TÍTULO DA VARIAÇÃO], [ESTRUTURA VISUAL], [NOVA COPY].
      - A NOVA COPY deve terminar obrigatoriamente com uma pergunta estratégica.
      - Seja conciso e direto ao ponto.
      - Retorne em formato JSON estruturado com uma lista de variações.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    
    // Limpeza de possíveis blocos de código markdown do JSON
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    return NextResponse.json({ 
      success: true, 
      analysis: text // Esperamos que a IA siga o formato de briefing
    });

  } catch (error) {
    console.error('Creative Lab IA Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
