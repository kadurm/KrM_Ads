# KrM_Ads - Diretrizes do Projeto e Contexto do Agente

## 1. Visão Geral do Sistema
O KrM_Ads é um SaaS Fullstack projetado para a gestão de campanhas de tráfego pago, sincronização de métricas e geração automatizada de relatórios com Inteligência Artificial (Google Gemini).

## 2. Stack Tecnológico Principal
- Framework: Next.js (App Router) na versão mais recente e segura.
- Estilização: Tailwind CSS (configuração enxuta focada em classes padrão) e ícones lucide-react.
- Banco de Dados: PostgreSQL (hospedado no Supabase).
- ORM: Prisma.
- Hospedagem/Deploy: Vercel.

## 3. Regras de Infraestrutura e Dependências
- Gerenciador de Pacotes: Exclusivamente npm.
- Conflitos de Versão: O ecossistema roda com um arquivo .npmrc contendo legacy-peer-deps=true para evitar travamentos de conflito entre o React 19 e as dependências do Prisma/Next.js. Não remova este arquivo.
- Segurança: O projeto foi blindado contra vulnerabilidades. Sempre mantenha o Next.js atualizado via npm install next@latest caso a Vercel barre o deploy por questões de segurança.

## 4. Padrões de Arquitetura de Código
- Backend Serverless: Não criamos servidores Express isolados. Toda a lógica de backend deve residir em Route Handlers do Next.js dentro da pasta app/api/...
- Sincronização de Banco de Dados: Qualquer nova tabela ou coluna deve ser adicionada no arquivo prisma/schema.prisma. A sincronização com a nuvem deve ser feita via conexão direta utilizando o comando npx prisma db push.
- CSS: O arquivo app/globals.css deve ser mantido extremamente limpo, contendo apenas as diretivas base do Tailwind para evitar erros de compilação na Vercel.

## 5. Regras de Negócio e Comportamento (CRUCIAL)
- Copywriting e Scripts de Vendas: Sempre que o sistema (ou a IA Gemini integrada a ele) for programado para gerar textos, abordagens ou scripts de vendas para os anúncios, a regra inquebrável é: NUNCA finalize os textos com afirmações. O texto deve SEMPRE ser finalizado com perguntas. O vendedor é quem deve guiar e manter o controle da conversa.

## 6. Objetivos Imediatos
1. [Concluído] Validar conexão com banco de dados Supabase via Prisma.
2. [Concluído] Implementar fluxo de sincronização com Meta Ads API (Sincronização segmentada por cliente configurada via `.env` dinâmico).
3. [Pendente] Configurar geração de diagnóstico de performance via IA (Gemini).

## 7. Protocolo de Sincronização e Trabalho
- Protocolo de Trabalho: Existe um rigoroso protocolo de sincronização onde cada alteração estrutural deve ser registrada no agent.md para manter a consistência entre diferentes sessões de IA.
- Realidade Material: O Agente deve priorizar os arquivos físicos e logs de erro fornecidos pelo usuário em detrimento de sua própria memória de sessões passadas.
- Gestão de Tokens (Meta Ads): Por decisão técnica (abril/2026), a gestão de tokens de múltiplos clientes está sendo feita temporariamente via `.env` de forma dinâmica (ex: `META_ACCESS_TOKEN_Fulltime`). A migração dessas chaves para o Banco de Dados (tabela `Cliente`) ocorrerá no futuro.