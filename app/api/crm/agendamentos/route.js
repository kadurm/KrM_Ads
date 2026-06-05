import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET: Retorna todos os agendamentos cadastrados de um cliente
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const cliente = searchParams.get('cliente');

    if (!cliente) {
      return NextResponse.json({ success: false, error: 'Cliente não especificado' }, { status: 400 });
    }

    const agendamentos = await prisma.agendamento.findMany({
      where: {
        lead: {
          OR: [
            { cliente: { slug: cliente } },
            { cliente: { nome: cliente } }
          ]
        }
      },
      include: {
        lead: true
      },
      orderBy: {
        data_hora: 'asc'
      }
    });

    return NextResponse.json({ success: true, agendamentos });
  } catch (error) {
    console.error('Agendamentos GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Cria um novo agendamento e adiciona uma nota no histórico do lead
export async function POST(request) {
  try {
    const { lead_id, tipo, data_hora, observacao } = await request.json();

    if (!lead_id || !tipo || !data_hora) {
      return NextResponse.json({ success: false, error: 'Dados incompletos para agendamento' }, { status: 400 });
    }

    // Cria o agendamento
    const agendamento = await prisma.agendamento.create({
      data: {
        lead_id,
        tipo,
        data_hora: new Date(data_hora),
        observacao,
        status: 'AGENDADO'
      },
      include: {
        lead: true
      }
    });

    // Tradução legível do tipo de agendamento para a nota
    const tipoLegivel = tipo === 'PRONTA_ENTREGA' 
      ? 'Compra de veículo pronta entrega' 
      : 'Blindagem do veículo do cliente';

    const dataFormatada = new Date(data_hora).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Cria nota automática de histórico no Lead
    await prisma.nota.create({
      data: {
        lead_id,
        texto: `[Agendamento] Comprometido: ${tipoLegivel} marcado para ${dataFormatada}.${observacao ? ` Obs: ${observacao}` : ''}`,
        autor: 'Sistema'
      }
    });

    return NextResponse.json({ success: true, agendamento });
  } catch (error) {
    console.error('Agendamentos POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH: Atualiza o status ou data/observação de um agendamento
export async function PATCH(request) {
  try {
    const { id, status, data_hora, observacao } = await request.json();

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID do agendamento não informado' }, { status: 400 });
    }

    const oldAgendamento = await prisma.agendamento.findUnique({
      where: { id },
      include: { lead: true }
    });

    if (!oldAgendamento) {
      return NextResponse.json({ success: false, error: 'Agendamento não encontrado' }, { status: 404 });
    }

    const agendamento = await prisma.agendamento.update({
      where: { id },
      data: {
        status: status !== undefined ? status : undefined,
        data_hora: data_hora ? new Date(data_hora) : undefined,
        observacao: observacao !== undefined ? observacao : undefined
      }
    });

    // Se o status mudou, registra no histórico do lead
    if (status && status !== oldAgendamento.status) {
      const statusLegivel = status === 'REALIZADO' ? 'Realizado' : status === 'CANCELADO' ? 'Cancelado' : status;
      const tipoLegivel = oldAgendamento.tipo === 'PRONTA_ENTREGA' 
        ? 'Compra de veículo pronta entrega' 
        : 'Blindagem do veículo do cliente';

      await prisma.nota.create({
        data: {
          lead_id: oldAgendamento.lead_id,
          texto: `[Agendamento Atualizado] O agendamento para ${tipoLegivel} foi marcado como: ${statusLegivel}.`,
          autor: 'Sistema'
        }
      });
    }

    return NextResponse.json({ success: true, agendamento });
  } catch (error) {
    console.error('Agendamentos PATCH Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE: Exclui um agendamento
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID não informado' }, { status: 400 });
    }

    const agendamento = await prisma.agendamento.findUnique({
      where: { id }
    });

    if (agendamento) {
      await prisma.agendamento.delete({
        where: { id }
      });

      // Registra a remoção
      await prisma.nota.create({
        data: {
          lead_id: agendamento.lead_id,
          texto: `[Agendamento Removido] O agendamento anterior foi excluído do sistema.`,
          autor: 'Sistema'
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Agendamentos DELETE Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
