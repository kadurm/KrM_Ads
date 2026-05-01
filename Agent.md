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
2. [Concluído] Implementar fluxo de sincronização com Meta Ads API.
3. [Concluído] Configurar geração de diagnóstico de performance via IA (Gemini).
4. [Concluído] Migrar gestão de tokens Meta Ads para Multi-Tenancy dinâmico no Banco de Dados.
5. [Concluído] Implementar Andromeda Deep Learning (Motor de Aprendizado Autônomo via Cron).
6. [Concluído] Integração de Funil de Vendas CRM -> Meta (Offline Conversions via CAPI).

## 7. Protocolo de Sincronização e Trabalho
- Protocolo de Trabalho: Existe um rigoroso protocolo de sincronização onde cada alteração estrutural deve ser registrada no agent.md para manter a consistência entre diferentes sessões de IA.
- Realidade Material: O Agente deve priorizar os arquivos físicos e logs de erro fornecidos pelo usuário em detrimento de sua própria memória de sessões passadas.
- Gestão de Tokens (Meta Ads): A gestão de tokens é feita de forma dinâmica e Multi-Tenant diretamente na tabela `Cliente` do banco de dados. Isso permite a adição e gerenciamento de múltiplas contas Meta sem necessidade de variáveis de ambiente (.env) individuais ou novos deploys.
- Aprendizado Contínuo (Deep Learning): O sistema possui um motor autônomo que analisa campanhas, criativos e dados do CRM semanalmente, atualizando automaticamente o contexto estratégico (`insights`) de cada cliente com base em performance real.
- Conversões Offline (CAPI): O sistema está conectado à Conversions API da Meta. Sempre que um lead muda para o status "FECHADO" no CRM interno, um evento de "Purchase" é enviado à Meta para otimizar o algoritmo de ROAS.