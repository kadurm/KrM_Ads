import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const clientes = await prisma.cliente.findMany({
      orderBy: { nome: 'asc' }
    });
    return NextResponse.json({ success: true, clientes });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { nome, meta_ads_account_id, meta_access_token } = await request.json();
    
    if (!nome || !meta_ads_account_id) {
      return NextResponse.json({ success: false, error: "Nome e ID da conta são obrigatórios" }, { status: 400 });
    }

    const agentTemplate = `# Contexto Estratégico: ${nome}

## Informações da Empresa
- Objetivo Principal:
- Público-Alvo Ideal:
- Principais Diferenciais:
- Tom de Voz (Style Guide):

## Contexto IA
- Modelo: Gemini 2.5 Flash
- Regra de Copywriting: Terminar sempre com uma pergunta estratégica.
- Foco de Análise: [ROI / Escala / Reconhecimento]
`;

    const cliente = await prisma.cliente.create({
      data: { 
        nome, 
        meta_ads_account_id,
        meta_access_token,
        insights: agentTemplate
      }
    });

    try {
      const refDir = path.join(process.cwd(), 'ref', nome);
      if (!fs.existsSync(refDir)) {
        fs.mkdirSync(refDir, { recursive: true });
        fs.writeFileSync(path.join(refDir, 'agent.md'), agentTemplate);
      }
    } catch (fsError) {
      console.warn("Aviso: Não foi possível criar pasta física.");
    }

    return NextResponse.json({ success: true, cliente });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { id, nome, meta_ads_account_id, meta_access_token, insights } = await request.json();
    if (!id) return NextResponse.json({ success: false, error: "ID do cliente é obrigatório" }, { status: 400 });

    const cliente = await prisma.cliente.update({
      where: { id },
      data: { nome, meta_ads_account_id, meta_access_token, insights }
    });

    return NextResponse.json({ success: true, cliente });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: "ID do cliente é obrigatório" }, { status: 400 });

    // Nota: Em um sistema real, você pode querer deletar em cascata ou apenas desativar.
    // Aqui deletamos as métricas relacionadas antes do cliente para evitar erro de FK (se não configurado cascata no BD)
    // No schema atual, Campanhas dependem de Clientes.
    
    await prisma.cliente.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
