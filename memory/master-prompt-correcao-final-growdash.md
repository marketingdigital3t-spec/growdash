---
name: master-prompt-correcao-final-growdash
description: Prompt mestre para correção dos 10 ataques pendentes da auditoria da Growdash
metadata:
  type: project
---

# Prompt Master — Correção Final da Growdash (Auditoria 2026-11-16)

## Objetivo

Aplicar todos os 10 ataques do plano de auditoria de forma sistemática, um por vez, com testes, build e deploy a cada etapa.

## Contexto

A integração Meta Ads + RD Station CRM da Growdash estava com problemas críticos de escopo, escopo de etapas, sincronização e segurança. O código já foi corrigido para as 4 causas raiz principais (escopo de funis, etapa por chave incompleta, oscilação por invalidação do Realtime, sincronização manual incompleta). As correções de segurança (RLS, escopo de conta, selo de sync) já foram aplicadas.

O que resta são 10 itens de melhoria e correção:

## Os 10 itens a serem corrigidos

### 1. Cron de daily-reconciliation nunca existe (alta)
A função `daily-reconciliation` nunca foi agendada no pg_cron. Precisa criar migration para agendar diariamente às 04:00 BRT.

Arquivo: `supabase/migrations/20261117040000_daily_rd_reconciliation_sync.sql` (já criado)

### 2. Botão "Executar agora" retorna 401 (crítico)
O frontend `JobRunsCard.tsx` chama `supabase.functions.invoke("daily-reconciliation")` com JWT do usuário, mas a função só aceita service_role ou cron secret.

Arquivo: `src/components/data-health/JobRunsCard.tsx`
Solução: alterar para usar `supabase.functions.invoke("rd-reconcile-metrics")` que já aceita service_role, ou criar uma nova edge function que aceite JWT do usuário.

### 3. Enriquecimento de estados (médio)
Aplicar `rd-enrich-states` em lotes até cobrir os 2.744 deals sem estado.

### 4. 5 conexões RD com erro (alto)
Verificar e corrigir as 5 conexões com erro de sincronização.

### 5. 2 contas RD nunca sincronizadas (médio)
CA02-Natália e CA02-Fernanda nunca sincronizaram.

### 6. Bundle de 1,8 MB e CSS de 15k linhas (médio)
Otimizar bundle do Vite e CSS.

### 7. 7 contas sem action_type (médio)
Configurar action_type para as 7 contas Meta ativas.

### 8. 4 campanhas com spend sem leads (baixo)
Corrigir campanhas com spend > R$50 e 0 leads.

### 9. Claims de conformidade (alto)
Verificar se todas as claims de consentimento, privacidade, uso de imagem e riscos de comunicação estão cobertas.

### 10. Observabilidade (médio)
Adicionar correlation ID e alertas nas Edge Functions críticas.

## Regras de execução

1. Um problema por vez.
2. Cada correção deve ter testes unitários.
3. Menor diff possível.
4. Não usar o GitHub Actions como interpretador de erros SQL.
5. Migrations antes do commit: verificar schemas, nomes reais de colunas, blocos condicionais IF EXISTS.
6. Não declarar produção validada enquanto o domínio principal estiver servindo versão anterior.
7. Validar no browser após cada deploy.

## Ordem de execução

1. Item 1: Cron de daily-reconciliation (crítico)
2. Item 2: Botão "Executar agora" 401 (crítico)
3. Item 3: Enriquecimento de estados (médio)
4. Item 4: 5 conexões RD com erro (médio)
5. Item 5: 2 contas RD nunca sincronizadas (médio)
6. Item 6: Bundle e CSS (médio)
7. Item 7: 7 contas sem action_type (médio)
8. Item 8: 4 campanhas sem leads (baixo)
9. Item 9: Claims de conformidade (alto)
10. Item 10: Observabilidade (médio)

## Como usar

Cada item deve ser executado seguindo o loop:
1. Ler o código existente
2. Implementar a correção
3. Criar/escrever teste unitário
4. Rodar testes
5. Build de produção
6. Commit e push
+ Deploy no Cloudflare Pages
7. Verificar em produção no navegador

Não pule etapas. Não execute múltiplos itens em paralelo que toquem nos mesmos dados.