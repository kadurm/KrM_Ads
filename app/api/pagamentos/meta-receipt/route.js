import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const clienteNome = searchParams.get('cliente');
    const mes = searchParams.get('mes'); // 0-based (0 = Jan)
    const ano = searchParams.get('ano');

    if (!clienteNome || mes === null || !ano) {
       return NextResponse.json({ success: false, error: 'Parâmetros cliente, mes e ano são obrigatórios.' }, { status: 400 });
    }

    const cliente = await prisma.cliente.findFirst({ 
      where: { 
        OR: [
          { nome: { equals: clienteNome, mode: 'insensitive' } },
          { slug: { equals: clienteNome, mode: 'insensitive' } }
        ]
      } 
    });
    
    if (!cliente) return NextResponse.json({ success: false, error: 'Cliente não encontrado.' }, { status: 404 });

    const m = parseInt(mes);
    const a = parseInt(ano);
    const startDate = new Date(a, m, 1, 0, 0, 0);
    const endDate = new Date(a, m + 1, 0, 23, 59, 59);

    const metrics = await prisma.metricaCampanha.aggregate({
      where: {
        campanha: { cliente_id: cliente.id },
        data: { gte: startDate, lte: endDate }
      },
      _sum: {
        valor_investido: true
      }
    });

    const totalInvestido = Number(metrics._sum.valor_investido || 0);

    return NextResponse.json({
      success: true,
      cliente: cliente.nome,
      periodo: { 
        mes: m + 1, 
        ano: a,
        nomeMes: new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(startDate)
      },
      totalInvestido,
      dataGeracao: new Date().toISOString(),
      autenticidade: `META-KRM-${a}${String(m+1).padStart(2, '0')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
    });

  } catch (error) {
    console.error('Erro ao buscar dados do recibo Meta:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
