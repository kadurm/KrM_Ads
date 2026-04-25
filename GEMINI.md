# Regras de Desenvolvimento Gemini

## Modelos de IA
- **Modelo Principal:** `gemini-2.5-flash` (Deve ser mantido em todos os endpoints de geração).

## Contexto Estratégico (agent.md)
- Todo cliente deve possuir um arquivo `ref/[Nome]/agent.md`.
- Este arquivo deve conter o "coração" da estratégia do cliente.
- O endpoint `/api/relatorios/generate` prioriza o conteúdo deste arquivo para personalizar o tom de voz e os diagnósticos.

## Regras de Resposta
- Todo texto gerado para relatórios ou copywriting DEVE terminar com uma **pergunta estratégica**.
- Manter foco absoluto em ROI e métricas reais (Meta Ads).

## Stack Tecnológica
- **Framework:** Next.js (React 19, TypeScript)
- **Banco de Dados:** PostgreSQL (Supabase) via **Prisma ORM**
- **Estilização:** Tailwind CSS & Lucide Icons
- **Gráficos:** Recharts
- **IA:** Google Generative AI (Gemini 1.5 Flash)

## Arquitetura de Dados e Sincronização
O sistema utiliza um modelo de **Sincronização Diária Fiel**:
1.  **MetricaCampanha:** Armazena dados diários (`time_increment: 1`) por campanha. Possui uma restrição única `@@unique([campanha_id, data])` para evitar duplicidade.
2.  **Agregação Dinâmica:** O endpoint `GET /api/meta/sync` calcula a soma das métricas no período solicitado (`since` e `until`), garantindo que o investimento total e os leads sejam sempre precisos, independente de quantos syncs foram realizados.
3.  **Criativos:** Sincroniza metadados (imagem, texto) e métricas acumuladas para identificar as peças de melhor performance (Ranking por CPA).

## Comandos Principais
- `npm run dev`: Inicia o servidor de desenvolvimento.
- `npx prisma db push`: Sincroniza o schema do Prisma com o banco de dados (usar para alterações estruturais).
- `npx prisma generate`: Gera o cliente Prisma.
- `npm run build`: Gera o build de produção (Prisma + Next.js).

## Protocolo de Desenvolvimento
- **Pesquisa e Planejamento:** Antes de qualquer alteração no código, é obrigatório realizar uma investigação detalhada da estrutura atual e elaborar um plano de execução claro, documentando-o se necessário.
- **Ciclo de Vida e Autonomia:** Ao finalizar uma atualização e publicar (GitHub/Vercel), o agente DEVE realizar uma inspeção técnica para verificar se a funcionalidade opera como esperado. Caso detecte falhas, o agente tem autonomia e obrigação de buscar alternativas e aplicar correções automaticamente até que o objetivo seja atingido, evitando turnos de retrabalho por parte do usuário.
- **Regra de Ouro (Copywriting):** Todo texto gerado pela IA ou sistema para anúncios/relatórios deve terminar obrigatoriamente com uma **pergunta estratégica**.
- **Gestão de Tokens:** Temporariamente via `.env` dinâmico (ex: `META_ACCESS_TOKEN_Cliente`).
- **Segurança:** Legacy peer dependencies habilitado no `.npmrc` para compatibilidade com React 19.

## Endpoints de API
- `POST /api/meta/sync`: Aciona a sincronização com a Graph API da Meta (requer `cliente`, `since`, `until`).
- `GET /api/meta/sync`: Retorna métricas agregadas e ranking de criativos.
- `POST /api/relatorios/generate`: Gera diagnóstico via Gemini baseado em referências de estilo em `/ref/[Cliente]`.
