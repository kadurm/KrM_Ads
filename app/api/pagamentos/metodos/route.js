import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

// GET /api/pagamentos/metodos?cliente=X
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const clienteNome = searchParams.get('cliente');

    if (!clienteNome) {
      return NextResponse.json({ success: false, error: 'Cliente não informado.' }, { status: 400 });
    }

    const cliente = await prisma.cliente.findFirst({ where: { nome: clienteNome } });
    if (!cliente) {
      return NextResponse.json({ success: false, error: 'Cliente não encontrado.' }, { status: 404 });
    }

    const metodos = await prisma.metodoPagamento.findMany({
      where: { cliente_id: cliente.id, ativo: true },
      orderBy: { is_principal: 'desc' },
    });

    return NextResponse.json({ success: true, metodos });
  } catch (error) {
    console.error('Erro ao buscar meios de pagamento:', error);
    return NextResponse.json({ success: false, error: 'Erro interno.' }, { status: 500 });
  }
}

// POST /api/pagamentos/metodos — Cadastra novo meio
export async function POST(req) {
  try {
    const body = await req.json();
    const { cliente, tipo, descricao, chave_pix, dados_banco, is_principal } = body;

    if (!cliente || !tipo || !descricao) {
      return NextResponse.json({ success: false, error: 'Campos obrigatórios: cliente, tipo, descricao.' }, { status: 400 });
    }

    const clienteDb = await prisma.cliente.findFirst({ where: { nome: cliente } });
    if (!clienteDb) {
      return NextResponse.json({ success: false, error: 'Cliente não encontrado.' }, { status: 404 });
    }

    // Se marcado como principal, desmarca os outros
    if (is_principal) {
      await prisma.metodoPagamento.updateMany({
        where: { cliente_id: clienteDb.id },
        data: { is_principal: false },
      });
    }

    const metodo = await prisma.metodoPagamento.create({
      data: {
        cliente_id: clienteDb.id,
        tipo,
        descricao,
        chave_pix: chave_pix || null,
        dados_banco: dados_banco || null,
        is_principal: is_principal || false,
      },
    });

    return NextResponse.json({ success: true, metodo });
  } catch (error) {
    console.error('Erro ao cadastrar meio de pagamento:', error);
    return NextResponse.json({ success: false, error: 'Erro interno.' }, { status: 500 });
  }
}

// PATCH /api/pagamentos/metodos — Atualiza meio de pagamento
export async function PATCH(req) {
  try {
    const body = await req.json();
    const { id, is_principal, ativo, descricao, chave_pix, dados_banco } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID obrigatório.' }, { status: 400 });
    }

    // Se marcando como principal, desmarca os demais do mesmo cliente
    if (is_principal) {
      const metodo = await prisma.metodoPagamento.findUnique({ where: { id } });
      if (metodo) {
        await prisma.metodoPagamento.updateMany({
          where: { cliente_id: metodo.cliente_id },
          data: { is_principal: false },
        });
      }
    }

    const updateData = {};
    if (is_principal !== undefined) updateData.is_principal = is_principal;
    if (ativo !== undefined) updateData.ativo = ativo;
    if (descricao) updateData.descricao = descricao;
    if (chave_pix !== undefined) updateData.chave_pix = chave_pix;
    if (dados_banco !== undefined) updateData.dados_banco = dados_banco;

    const updated = await prisma.metodoPagamento.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, metodo: updated });
  } catch (error) {
    console.error('Erro ao atualizar meio de pagamento:', error);
    return NextResponse.json({ success: false, error: 'Erro interno.' }, { status: 500 });
  }
}

// DELETE /api/pagamentos/metodos?id=X — Soft delete (desativa)
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID obrigatório.' }, { status: 400 });
    }

    await prisma.metodoPagamento.update({
      where: { id },
      data: { ativo: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao remover meio de pagamento:', error);
    return NextResponse.json({ success: false, error: 'Erro interno.' }, { status: 500 });
  }
}
