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
    const { nome, meta_ads_account_id } = await request.json();
    
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

    // Criar o cliente no banco com o template de insights
    const cliente = await prisma.cliente.create({
      data: { 
        nome, 
        meta_ads_account_id,
        insights: agentTemplate // Agora o contexto principal fica no BANCO DE DADOS
      }
    });

    // Tentativa segura de criar diretório de referências (funcionará local, mas falhará em produção sem derrubar a API)
    try {
      const refDir = path.join(process.cwd(), 'ref', nome);
      if (!fs.existsSync(refDir)) {
        fs.mkdirSync(refDir, { recursive: true });
        fs.writeFileSync(path.join(refDir, 'agent.md'), agentTemplate);
      }
    } catch (fsError) {
      console.warn("Aviso: Não foi possível criar pasta física (Ambiente Read-only). O contexto está salvo no banco.");
    }

    return NextResponse.json({ success: true, cliente });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
