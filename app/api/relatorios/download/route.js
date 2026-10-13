import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const relPath = searchParams.get('path');

    if (!relPath) {
      return NextResponse.json({ success: false, error: 'Parâmetro path é obrigatório.' }, { status: 400 });
    }

    // Normaliza e protege contra path traversal
    const safeRelPath = path.normalize(relPath).replace(/^(\.\.[\/\\])+/, '');
    if (!safeRelPath.startsWith('ref') && !safeRelPath.startsWith('public')) {
      return NextResponse.json({ success: false, error: 'Acesso não permitido.' }, { status: 403 });
    }

    const fullPath = path.join(process.cwd(), safeRelPath);

    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ success: false, error: 'Arquivo não encontrado.' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(fullPath);
    const fileName = path.basename(fullPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': fileBuffer.length.toString()
      }
    });

  } catch (error) {
    console.error('[API /api/relatorios/download] Erro:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
