import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const { lead_id, texto, autor } = await request.json();

    if (!lead_id || !texto) return NextResponse.json({ success: false, error: 'Dados incompletos' }, { status: 400 });

    const nota = await prisma.nota.create({
      data: {
        lead_id,
        texto,
        autor: autor || 'Sistema'
      }
    });

    return NextResponse.json({ success: true, nota });
  } catch (error) {
    console.error('CRM Nota POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
