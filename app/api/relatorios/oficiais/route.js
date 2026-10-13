import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const clienteParam = searchParams.get('cliente');

    if (!clienteParam) {
      return NextResponse.json({ success: false, error: 'Parâmetro cliente é obrigatório.' }, { status: 400 });
    }

    const slug = clienteParam.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '');

    const dbCliente = await prisma.cliente.findFirst({
      where: {
        OR: [
          { nome: { equals: clienteParam, mode: 'insensitive' } },
          { slug: { equals: slug, mode: 'insensitive' } },
          { slug: { equals: clienteParam.toLowerCase().replace(/ /g, ''), mode: 'insensitive' } }
        ]
      }
    });

    // 1. Relatórios consolidados/certificados no banco de dados
    let consolidados = [];
    if (dbCliente) {
      const records = await prisma.relatorioConsolidado.findMany({
        where: { cliente_id: dbCliente.id },
        orderBy: { periodo_inicio: 'desc' }
      });

      consolidados = records.map(r => ({
        id: r.id,
        tipo: 'CERTIFICADO_META',
        origem: r.origem,
        periodo_inicio: r.periodo_inicio ? r.periodo_inicio.toISOString().split('T')[0] : null,
        periodo_fim: r.periodo_fim ? r.periodo_fim.toISOString().split('T')[0] : null,
        total_spend: Number(r.total_spend || 0),
        total_leads: Number(r.total_leads || 0),
        total_impressoes: Number(r.total_impressoes || 0),
        total_alcance: Number(r.total_alcance || 0),
        total_visitas: Number(r.total_visitas || 0),
        criado_em: r.criado_em.toISOString()
      }));
    }

    // 2. Arquivos físicos (PDFs de relatórios / auditorias) em ref/[Cliente]
    const arquivosFisicos = [];
    const baseRefDir = path.join(process.cwd(), 'ref');
    
    // Encontrar pasta do cliente em ref
    if (fs.existsSync(baseRefDir)) {
      const clientFolders = fs.readdirSync(baseRefDir, { withFileTypes: true })
        .filter(d => d.isDirectory());
      
      const matchedFolder = clientFolders.find(d => {
        const folderNorm = d.name.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '');
        return folderNorm === slug || d.name.toLowerCase() === clienteParam.toLowerCase();
      });

      if (matchedFolder) {
        const clientPath = path.join(baseRefDir, matchedFolder.name);
        
        function scanDir(dir) {
          const items = fs.readdirSync(dir, { withFileTypes: true });
          for (const item of items) {
            const fullItemPath = path.join(dir, item.name);
            if (item.isDirectory()) {
              scanDir(fullItemPath);
            } else if (item.isFile() && item.name.toLowerCase().endsWith('.pdf')) {
              const stat = fs.statSync(fullItemPath);
              const relativePath = path.relative(process.cwd(), fullItemPath).replace(/\\/g, '/');
              arquivosFisicos.push({
                nome: item.name,
                tamanhoBytes: stat.size,
                modificadoEm: stat.mtime.toISOString(),
                caminho: relativePath,
                url: `/api/relatorios/download?path=${encodeURIComponent(relativePath)}`
              });
            }
          }
        }

        try {
          scanDir(clientPath);
        } catch (scanErr) {
          console.warn('[Oficiais] Erro ao varrer pasta física:', scanErr.message);
        }
      }
    }

    return NextResponse.json({
      success: true,
      cliente: dbCliente ? dbCliente.nome : clienteParam,
      consolidados,
      arquivosFisicos
    });

  } catch (error) {
    console.error('[API /api/relatorios/oficiais] Erro:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
