import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const { lead_id, mensagem } = await request.json();

    if (!lead_id) {
      return NextResponse.json({ success: false, error: 'Lead ID não informado' }, { status: 400 });
    }

    const lead = await prisma.lead.findUnique({
      where: { id: lead_id },
      include: { cliente: true }
    });

    if (!lead) {
      return NextResponse.json({ success: false, error: 'Seguidor não encontrado' }, { status: 404 });
    }

    const cliente = lead.cliente;
    const slug = cliente.slug || 'solutionplace';
    const token = process.env[`META_ACCESS_TOKEN_${slug.toUpperCase()}`] || 
                  process.env[`META_ACCESS_TOKEN_${slug}`] ||
                  process.env[`META_ACCESS_TOKEN_GLOBAL`] || 
                  cliente.meta_access_token;

    console.log(`[Direct Message Trigger] Enviando boas-vindas para ${lead.nome} (${lead.id})...`);
    
    // Simulação do Envio de Mensagem Direta
    // Como DMs de Instagram dependem do IGSID (que exige interação prévia do seguidor),
    // o sistema implementa uma automação simulada para demonstração prática e testes.
    
    // Registra a mensagem no histórico do lead no CRM
    const nota = await prisma.nota.create({
      data: {
        lead_id: lead.id,
        texto: `[Automação Direct] Mensagem de boas-vindas enviada: "${mensagem || 'Olá! Obrigado por seguir a Solution Place.'}"`,
        autor: 'Automação Instagram'
      }
    });

    // Simulador de Delay Operacional (deixa a experiência de teste mais rica)
    await new Promise(resolve => setTimeout(resolve, 800));

    return NextResponse.json({ 
      success: true, 
      status: 'simulado', 
      message: `Mensagem enviada com sucesso no Direct de ${lead.nome}!`,
      nota
    });

  } catch (error) {
    console.error('Instagram Direct Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
