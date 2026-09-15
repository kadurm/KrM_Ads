import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

import { smartClassifyLead, mapCrmStatus } from '@/utils/xmlParser';

function parseBrazilianDate(dateInput) {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) return dateInput;

  const str = String(dateInput).trim();
  if (!str) return new Date();

  // 1. Formato DD/MM/YYYY ou DD/MM/YYYY HH:MM:SS ou DD-MM-YYYY
  const brMatch = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (brMatch) {
    let [, day, month, year, hour = '0', minute = '0', second = '0'] = brMatch;
    if (year.length === 2) year = '20' + year;
    const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), parseInt(hour, 10), parseInt(minute, 10), parseInt(second, 10));
    if (!isNaN(d.getTime())) return d;
  }

  // 2. Formato YYYY-MM-DD ou YYYY-MM-DD HH:MM
  const isoMatch = str.match(/^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})(?:\s+T?(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (isoMatch) {
    let [, year, month, day, hour = '0', minute = '0', second = '0'] = isoMatch;
    const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), parseInt(hour, 10), parseInt(minute, 10), parseInt(second, 10));
    if (!isNaN(d.getTime())) return d;
  }

  // 3. Fallback nativo
  const nativeParsed = new Date(str);
  if (!isNaN(nativeParsed.getTime())) return nativeParsed;

  return new Date();
}

export async function POST(request) {
  try {
    const { cliente, leads } = await request.json();

    if (!cliente || !Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Cliente ou lista de leads inválida para importação.' },
        { status: 400 }
      );
    }

    const clienteDb = await prisma.cliente.findFirst({
      where: {
        OR: [
          { slug: cliente },
          { nome: cliente }
        ]
      }
    });

    if (!clienteDb) {
      return NextResponse.json(
        { success: false, error: `Cliente '${cliente}' não encontrado no banco de dados.` },
        { status: 404 }
      );
    }

    // Prepara lote de inserção sanitizado com inteligência de conteúdo, cores de status e conversão fiel
    const preparedLeads = [];

    for (const rawItem of leads) {
      const classified = smartClassifyLead(rawItem);

      // Descartar linhas de cabeçalho acidentais
      const nomeUpper = String(classified.nome || '').toUpperCase();
      if (
        nomeUpper.includes('NOME DO CLIENTE') ||
        nomeUpper === 'CLIENTE' ||
        nomeUpper === 'DATA' ||
        (!classified.contato && !classified.veiculo && !classified.tipo_servico)
      ) {
        continue;
      }

      const leadDate = classified.data ? parseBrazilianDate(classified.data) : new Date();

      let parsedValor = Number(classified.valor || 0);
      if (!parsedValor && rawItem.valor !== undefined && rawItem.valor !== null && rawItem.valor !== '') {
        const valStr = String(rawItem.valor).replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
        const num = parseFloat(valStr);
        if (!isNaN(num)) parsedValor = num;
      }

      // Conversão Macro da planilha (ex: "POSITIVO", "NEGATIVO", "AGUARDANDO", "DESQUALIFICADO", "X")
      const conversaoMacro = classified.conversao || rawItem.conversao || 'X';

      // Status Micro / Detalhado do atendimento (ex: "ENCAMINHADO PARA O COMERCIAL", "NÃO RESPONDEU")
      const statusDetalhe = classified.status_detalhe || rawItem.status_detalhe || rawItem.status || null;

      // Status do funil CRM (FECHADO, PERDIDO, NEGOCIACAO, CONTATO, NOVO)
      const statusFinal = classified.status || mapCrmStatus(conversaoMacro, statusDetalhe, parsedValor);

      preparedLeads.push({
        cliente_id: clienteDb.id,
        nome: String(classified.nome || 'Lead sem nome').trim(),
        contato: classified.contato ? String(classified.contato).trim() : null,
        status: statusFinal,
        valor: parsedValor,
        origem: classified.origem ? String(classified.origem).trim() : 'IMPORTACAO_PLANILHA',
        primeira_mensagem: classified.primeira_mensagem ? String(classified.primeira_mensagem).trim() : null,
        tipo_servico: classified.tipo_servico ? String(classified.tipo_servico).trim() : null,
        veiculo: classified.veiculo ? String(classified.veiculo).trim() : null,
        comercial: classified.comercial ? String(classified.comercial).trim() : null,
        conversao: conversaoMacro,
        status_detalhe: statusDetalhe,
        data: leadDate
      });

      // Sincronização espelho com LeadSolution se tiver telefone
      if (classified.contato) {
        prisma.leadSolution.upsert({
          where: { telefone: String(classified.contato).trim() },
          update: {
            data: leadDate,
            nome_cliente: classified.nome,
            origem: classified.origem,
            primeira_mensagem: classified.primeira_mensagem,
            tipo_servico: classified.tipo_servico,
            veiculo: classified.veiculo,
            comercial: classified.comercial,
            conversao: conversaoMacro,
            status: statusDetalhe,
            valor_faturado: parsedValor
          },
          create: {
            telefone: String(classified.contato).trim(),
            data: leadDate,
            nome_cliente: classified.nome,
            origem: classified.origem,
            primeira_mensagem: classified.primeira_mensagem,
            tipo_servico: classified.tipo_servico,
            veiculo: classified.veiculo,
            comercial: classified.comercial,
            conversao: conversaoMacro,
            status: statusDetalhe,
            valor_faturado: parsedValor
          }
        }).catch(err => console.warn('[LeadSolution Sync Warn]', err.message));
      }
    }

    const result = await prisma.lead.createMany({
      data: preparedLeads
    });

    return NextResponse.json({
      success: true,
      count: result.count,
      message: `${result.count} leads importados com sucesso para ${clienteDb.nome}!`
    });
  } catch (error) {
    console.error('CRM Import Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
