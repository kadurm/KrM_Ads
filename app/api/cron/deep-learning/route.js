import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function GET(request) {
  try {
    // Verificação de Segurança (CRON_SECRET deve estar no .env da Vercel)
    const authHeader = request.headers.get('authorization');
    console.log(`[Deep Learning] Auth Header: ${authHeader}`);

    if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // Fallback para permitir chamadas via Vercel Cron que às vezes usa chaves internas ou bypass em certos contextos de dashboard
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
      }
    }

    const clientes = await prisma.cliente.findMany();
    const results = [];

    for (const cliente of clientes) {
      console.log(`[Deep Learning] Processando cliente: ${cliente.nome}`);
      
      // 1. Coleta de Dados de Performance (Últimos 30 dias)
      const trintaDiasAtras = new Date();
      trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

      const [campanhas, criativos, vendasReais] = await Promise.all([
        prisma.campanha.findMany({
          where: { cliente_id: cliente.id },
          include: { 
            metricas: { where: { data: { gte: trintaDiasAtras } } } 
          }
        }),
        prisma.criativo.findMany({
          where: { campanha: { cliente_id: cliente.id } },
          include: { 
            metricas: { where: { data: { gte: trintaDiasAtras } } } 
          }
        }),
        prisma.lead.findMany({
          where: { cliente_id: cliente.id, status: 'FECHADO' },
          select: { nome: true, valor: true, origem: true, criado_em: true }
        })
      ]);

      // 2. Sumarização para a IA
      const performanceSummary = campanhas.map(c => {
        const totalSpend = c.metricas.reduce((acc, m) => acc + Number(m.valor_investido), 0);
        const totalLeads = c.metricas.reduce((acc, m) => acc + m.conversas_leads, 0);
        return `- Campanha: ${c.nome_gerado} | Gasto: R$ ${totalSpend.toFixed(2)} | Leads: ${totalLeads} | CPA: R$ ${totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : 'N/A'}`;
      }).join('\n');

      const creativeSummary = criativos
        .map(c => {
          const spend = c.metricas.reduce((acc, m) => acc + Number(m.valor_investido), 0);
          const leads = c.metricas.reduce((acc, m) => acc + m.leads, 0);
          const ctr = c.metricas.length > 0 ? c.metricas.reduce((acc, m) => acc + Number(m.ctr || 0), 0) / c.metricas.length : 0;
          return { name: c.nome_anuncio, copy: c.texto_principal, spend, leads, ctr };
        })
        .filter(c => c.spend > 0)
        .sort((a, b) => (a.leads > 0 ? a.spend / a.leads : 999) - (b.leads > 0 ? b.spend / b.leads : 999))
        .slice(0, 5) // Top 5 criativos
        .map(c => `- Criativo: ${c.name} | CTR: ${c.ctr.toFixed(2)}% | Leads: ${c.leads} | Copy: ${c.copy?.substring(0, 100)}...`)
        .join('\n');

      const crmSummary = vendasReais.map(v => `- Venda: R$ ${Number(v.valor).toFixed(2)} | Origem: ${v.origem || 'Direto'} | Data: ${v.criado_em.toLocaleDateString()}`).join('\n');

      // 3. Prompt de Evolução Andromeda
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const prompt = `
        Você é o motor de Deep Learning do sistema KrM Ads (Andromeda Engine).
        Seu objetivo é EVOLUIR o conhecimento estratégico do cliente "${cliente.nome}".

        CONTEXTO ATUAL (AGENT.MD):
        ${cliente.insights || 'Vazio.'}

        DADOS DE PERFORMANCE (ÚLTIMOS 30 DIAS):
        ${performanceSummary || 'Sem dados de campanha.'}

        TOP 5 CRIATIVOS (POR CPA):
        ${creativeSummary || 'Sem dados de criativos.'}

        VENDAS REAIS (CRM - LEADS FECHADOS):
        ${crmSummary || 'Sem vendas registradas no CRM.'}

        TAREFA:
        1. Classifique o "Setor Comercial" (Ramo de Atuação) desta empresa em apenas 1 ou 2 palavras (ex: Advocacia, Saúde, Tecnologia, Ecommerce, Infoproduto).
        2. Reescreva o CONTEXTO ESTRATÉGICO (AGENT.MD) incorporando os novos aprendizados.
           - Identifique quais tipos de criativos estão trazendo leads que de fato FECHAM vendas.
           - Refine o "Público-Alvo Ideal" com base nas campanhas de melhor CPA.
           - Ajuste as "Diretrizes de Copy" e "Identidade Visual" com base nos padrões dos criativos campeões.
           - Adicione uma seção de "MEMÓRIAS DE LONGO PRAZO" com aprendizados específicos.

        REGRAS DE RETORNO (JSON OBRIGATÓRIO):
        Retorne um objeto JSON com as chaves:
        - "setor": O ramo de atuação identificado.
        - "insights": O novo conteúdo completo do agent.md em Markdown.

        O campo insights deve terminar obrigatoriamente com uma pergunta estratégica para o gestor.
      `;

      const result = await model.generateContent(prompt);
      let responseText = result.response.text().trim();
      
      // Limpeza de Markdown JSON
      responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      try {
        const parsed = JSON.parse(responseText);
        const updatedInsights = parsed.insights;
        const extractedSector = parsed.setor;

        if (updatedInsights && updatedInsights.length > 100) {
          await prisma.cliente.update({
            where: { id: cliente.id },
            data: { 
              insights: updatedInsights,
              setor: extractedSector || cliente.setor
            }
          });
          results.push({ cliente: cliente.nome, status: 'Evoluído', setor: extractedSector });
        }
      } catch (parseError) {
        console.error(`Erro ao parsear retorno do Gemini para ${cliente.nome}:`, parseError);
        results.push({ cliente: cliente.nome, status: 'Erro no formato da IA' });
      }
    }

    return NextResponse.json({ success: true, results });

  } catch (error) {
    console.error('[Deep Learning Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
