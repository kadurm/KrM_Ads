import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

/** Função para salvar arquivo físico de contexto e histórico (Save Point) */
function saveContextFile(clienteNome, conteudo) {
  try {
    const safeNome = clienteNome.normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, '_');
    const baseDir = path.join(process.cwd(), 'ref', safeNome);
    const historyDir = path.join(baseDir, 'history');

    // Garante que as pastas existem
    if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });

    // 1. Salva o contexto ATUAL
    fs.writeFileSync(path.join(baseDir, 'agent.md'), conteudo);

    // 2. Salva o SAVE POINT datado
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    const fileName = `agent_${timestamp}.md`;
    fs.writeFileSync(path.join(historyDir, fileName), conteudo);

    console.log(`[File System] Contexto e Save Point salvos para ${clienteNome}`);
  } catch (e) {
    console.warn(`[File System Warning] Falha ao salvar arquivo físico: ${e.message}`);
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const clienteId = searchParams.get('id');

    if (clienteId) {
      const cliente = await prisma.cliente.findUnique({
        where: { id: clienteId },
        include: {
          historico_contexto: {
            orderBy: { criado_em: 'desc' }
          }
        }
      });
      return NextResponse.json({ success: true, cliente });
    }

    const clientes = await prisma.cliente.findMany({
      orderBy: { nome: 'asc' }
    });
    return NextResponse.json({ success: true, clientes });
  } catch (error) {
    console.error('Clientes GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { nome, meta_ads_account_id, meta_access_token, meta_pixel_id } = await request.json();
    
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
        meta_pixel_id,
        insights: agentTemplate
      }
    });

    // Tenta salvar arquivo físico inicial
    saveContextFile(nome, agentTemplate);

    return NextResponse.json({ success: true, cliente });
  } catch (error) {
    console.error('Clientes POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { id, nome, meta_ads_account_id, meta_access_token, meta_pixel_id, insights } = await request.json();
    if (!id) return NextResponse.json({ success: false, error: "ID do cliente é obrigatório" }, { status: 400 });

    // 1. Atualiza o Cliente
    const cliente = await prisma.cliente.update({
      where: { id },
      data: { nome, meta_ads_account_id, meta_access_token, meta_pixel_id, insights }
    });

    // 2. Se houver insights (agent.md), cria Save Point no Banco e no FS
    if (insights) {
      await prisma.historicoContexto.create({
        data: {
          cliente_id: id,
          conteudo: insights
        }
      });
      saveContextFile(nome || cliente.nome, insights);
    }

    return NextResponse.json({ success: true, cliente });
  } catch (error) {
    console.error('Clientes PATCH Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: "ID do cliente é obrigatório" }, { status: 400 });

    await prisma.cliente.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Clientes DELETE Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
