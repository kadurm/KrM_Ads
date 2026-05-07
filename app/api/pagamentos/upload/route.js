import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ success: false, error: 'Arquivo não fornecido.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64File = buffer.toString('base64');

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
      Atue como um assistente financeiro sênior da KrM Ads.
      Analise a Nota Fiscal enviada e extraia os dados necessários para registro no sistema.
      
      RETORNE APENAS UM JSON PURO, SEM MARKDOWN, NO SEGUINTE FORMATO:
      {
        "cliente": "Nome do cliente identificado na nota",
        "valor": 0.00,
        "data_emissao": "YYYY-MM-DD",
        "numero": 0,
        "descricao": "Resumo do serviço prestado"
      }

      REGRAS:
      1. Identifique o cliente entre os cadastrados abaixo. Se não houver correspondência exata, use o nome que aparece na nota.
      2. O valor deve ser numérico (float).
      3. A data deve estar no formato ISO (YYYY-MM-DD).
      4. A descrição deve ser curta e profissional.
    `;

    const clientes = await prisma.cliente.findMany({ select: { nome: true, slug: true } });
    const clientesContext = clientes.map(c => `${c.nome} (${c.slug || ''})`).join(', ');

    const finalPrompt = `${prompt}\n\nCLIENTES CADASTRADOS NO SISTEMA: ${clientesContext}`;

    const result = await model.generateContent([
      { text: finalPrompt },
      {
        inlineData: {
          mimeType: file.type,
          data: base64File
        }
      }
    ]);

    const responseText = result.response.text().trim().replace(/```json|```/g, '').trim();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error("Erro ao parsear JSON do Gemini:", responseText);
      throw new Error("Não foi possível extrair os dados da nota automaticamente. Certifique-se de que o arquivo é legível.");
    }

    // Tenta encontrar o cliente por nome ou slug
    const clienteMatch = await prisma.cliente.findFirst({
      where: {
        OR: [
          { nome: { contains: data.cliente, mode: 'insensitive' } },
          { slug: { contains: data.cliente, mode: 'insensitive' } },
          { nome: { contains: data.cliente.split(' ')[0], mode: 'insensitive' } }
        ]
      }
    });

    if (!clienteMatch) {
       return NextResponse.json({ 
         success: false, 
         error: `Cliente "${data.cliente}" não identificado no banco de dados. Cadastre o cliente primeiro ou verifique a nota.`,
         extractedData: data 
       }, { status: 404 });
    }

    // Cria a transação (marcada como PAGO pois já existe a NF)
    const transacao = await prisma.transacao.create({
      data: {
        cliente_id: clienteMatch.id,
        tipo: 'COBRANCA',
        categoria: 'SERVICO',
        descricao: data.descricao || `NF #${data.numero} - ${clienteMatch.nome}`,
        valor: parseFloat(data.valor),
        status: 'PAGO',
        data_pagamento: new Date(data.data_emissao + 'T12:00:00Z'),
        data_vencimento: new Date(data.data_emissao + 'T12:00:00Z'),
        referencia: `NF-${data.numero}`,
      }
    });

    // Cria o registro da Nota Fiscal vinculada
    const nota = await prisma.notaFiscal.create({
      data: {
        cliente_id: clienteMatch.id,
        transacao_id: transacao.id,
        numero: parseInt(data.numero) || 0,
        valor: parseFloat(data.valor),
        descricao: data.descricao || `Serviços de Marketing Digital`,
        status: 'EMITIDA',
      }
    });

    return NextResponse.json({ success: true, transacao, nota, cliente: clienteMatch.nome });

  } catch (error) {
    console.error('Erro no processamento de NF:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
