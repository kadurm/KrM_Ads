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

## Arquitetura de Dados e Sincronização (Motor Bulletproof)
O sistema opera sob o **Padrão Ouro de Extração**, garantindo fidelidade de 100% ao Gerenciador de Anúncios:
1.  **MetricaCampanha:** Armazena dados diários. Restrição `@@unique([campanha_id, data])`.
2.  **Soberania do Frontend & forceFullSync:** O Dashboard é o detentor da verdade temporal. Requisições POST com `forceFullSync: true` obrigam a API a reconstruir o histórico do período, ignorando janelas de segurança.
3.  **Motor de Paginação Infinita:** A API persegue todos os links de paginação da Meta (`paging.next`) para garantir que nenhum centavo ou lead seja perdido, eliminando vácuos de dados.
4.  **Heurística de Atribuição Universal (Visitas):** 
    - Se houver `instagram_profile_visit`, soma-se aos cliques (Tráfego Web/Carretel).
    - Se cliques de saída forem > 50% dos cliques no link, aplica-se a subtração `abs(link_clicks - outbound)` para isolar tráfego interno (Perfil/Solution).
    - Isso blinda a precisão em diferentes estratégias de tráfego.
5.  **Filtro de Leads Realista:** Apenas conversas iniciadas, cadastros e contatos são contados. Eventos `view_content` e `fb_pixel_custom` são banidos.
6.  **Creative HD Pipeline:** Ranking de criativos usa `image_hash`, `full_picture` (posts) e thumbnails forçadas em 800x800 para nitidez máxima.
7.  **Blindagem Lógica:** Proibido alterar algoritmos de cálculo sem consulta prévia.

## Comandos Principais
- `npm run dev`: Inicia o servidor de desenvolvimento.
- `npx prisma db push`: Sincroniza o schema do Prisma com o banco de dados (usar para alterações estruturais).
- `npx prisma generate`: Gera o cliente Prisma.
- `npm run build`: Gera o build de produção (Prisma + Next.js).

## Protocolo de Desenvolvimento
- **Pesquisa e Planejamento:** Antes de qualquer alteração no código, é obrigatório realizar uma investigação detalhada da estrutura atual e elaborar um plano de execução claro, documentando-o se necessário.
- **Ciclo de Vida e Autonomia:** Ao finalizar qualquer alteração no código, o agente DEVE realizar o deploy de produção para a Vercel (`npx vercel --prod --yes`) para que o usuário possa visualizar as atualizações imediatamente, seguido de uma inspeção técnica para verificar se a funcionalidade opera como esperado. Caso detecte falhas, o agente tem autonomia e obrigação de buscar alternativas e aplicar correções automaticamente até que o objetivo seja atingido, evitando turnos de retrabalho por parte do usuário.
- **Regra de Ouro (Copywriting):** Todo texto gerado pela IA ou sistema para anúncios/relatórios deve terminar obrigatoriamente com uma **pergunta estratégica**.
- **Gestão de Tokens:** Multi-Tenant via Banco de Dados (Tabela `Cliente`). Gerenciado dinamicamente pelo painel de administração.
- **Segurança:** Legacy peer dependencies habilitado no `.npmrc` para compatibilidade com React 19.

## Endpoints de API
- `POST /api/meta/sync`: Aciona a sincronização com a Graph API da Meta (requer `cliente`, `since`, `until`).
- `GET /api/meta/sync`: Retorna métricas agregadas e ranking de criativos.
- `POST /api/relatorios/generate`: Gera diagnóstico via Gemini baseado em referências de estilo em `/ref/[Cliente]`.
