---
name: plano-ataque-auditoria-growdash
description: Plano de ataque detalhado — corrigir todos os problemas da auditoria Growdash, um por um
metadata:
  type: project
---

# Plano de Ataque — Correção Completa da Plataforma Growdash

## O que este arquivo substitui

Não existe nenhum plano de ataque anterior neste repositório. Este arquivo consolida todos os problemas encontrados na auditoria ao vivo de `https://growdash.com.br` (integrações Meta Ads + RD Station CRM) e organiza as correções em 10 ataques sequenciais, um por um.

## Onde está linkado

Este arquivo está linkado a partir de `memory/MEMORY.md` e amplia o `memory/master-prompt-integracao-rd-crm.md`, que trata especificamente da correção da integração RD Station CRM. Este plano de ataque cobre TODOS os problemas da plataforma, não apenas a integração RD.

## Instrução verbatim do usuário

"Sim, vamos corrigir tudo montando um prompt para atacar um por 1"

O usuário quer que todos os problemas encontrados na auditoria sejam corrigidos, atacando cada um individualmente, em sequência.

---

# Plano de Ataque — Correção Completa da Plataforma Growdash

## Contexto

Esta é a sequência de ataque baseada na auditoria ao vivo de `https://growdash.com.br` (integrações Meta Ads + RD Station CRM) e no código local já corrigido mas ainda não promovido para produção.

**Status atual:**
- Código corrigido e commitado na branch `fix/growdash-integracao-rd-crm-sincronizacao` (commit `0c77b50`)
- Push para GitHub feito
- Deploy de preview no Cloudflare Pages: `fix-growdash-integracao-rd-c.growdash.pages.dev`
- Domínio de produção `growdash.com.br` AINDA está servindo a versão anterior (SEM as correções)

---

## Ataque 1 — Promover o código corrigido para produção (BLOQUEADOR)

### Por que primeiro
Sem promover para produção, nenhuma das correções de código afeta o usuário. O domínio `growdash.com.br` ainda serve a versão bugada.

### Ações
1. No Cloudflare Pages, promover o preview `fix-growdash-integracao-rd-c.growdash.pages.dev` para produção no domínio `growdash.com.br`
2. Verificar que o hash/commit servido em `growdash.com.br` corresponde ao commit `0c77b50`
3. Abrir a rota autenticada `/resumo-performance` e confirmar que o dashboard carrega sem erro
4. Abrir `/integracoes` (aba CRM & Vendas) e confirmar que a seção RD Station CRM exibe as conexões

### Critérios de aceitação
- `growdash.com.br` serve a versão com as correções (commit `0c77b50`)
- Página `/resumo-performance` não exibe mais valores zerados do funil (ou exibe dados reais do RD após sync)
- Página `/integracoes` aba "CRM & Vendas" carrega e exibe "RD Station CRM" conectado

---

## Ataque 2 — Aplicar migration no Supabase (vínculo contas Meta ↔ funis RD)

### Por que segundo
O banco de dados ainda tem funis vinculados a contas erradas (contaminação entre titulares). Mesmo com o código corrigido, os dados locais permanecem errados até aplicar a migration.

### Ações
1. Acessar https://app.supabase.com → projeto Growdash → SQL Editor
2. Executar dry-run da migration para verificar schemas e nomes reais de colunas (usar blocos condicionais `IF EXISTS`)
3. Aplicar migration que corrige o vínculo entre as contas Meta (CA01, CA02) e os funis do RD
4. Verificar que cada funil está vinculado à conta Meta correta na tabela `rd_funnels`

### Critérios de aceitação
- Migration executada sem erro no Supabase
- Cada funil RD está vinculado à `ad_account_id` correta (não há mais funis de Ranniely vinculados à conta da Natália e vice-versa)
- Nenhum funil fica órfão (sem conta Meta vinculada)

---

## Ataque 3 — Sincronizar as 2 contas RD nunca sincronizadas (CA02-Natália e CA02-Fernanda)

### Por que terceiro
Duas conexões RD estão "Autorizada · nunca sincronizada". Sem sync, não há dados do funil para essas contas.

### Ações
1. Em `/integracoes` → aba "CRM & Vendas" → seção "Conexões RD por conta"
2. Para CA02 - DRA NATÁLIA BARRAGÃO e CA02 - DRA FERNANDA, clicar em "Sincronizar" em cada funil vinculado
3. Verificar que o status muda de "nunca sincronizada" para "sucesso" ou "partial"
4. Se houver erro, anotar a mensagem e atacar como problema isolado

### Critérios de aceitação
- Ambas as conexões têm pelo menos um "Último sucesso" preenchido (não "Nunca sincronizado")
- Nenhuma conexão permanece com status "Autorizada · nunca sincronizada"

---

## Ataque 4 — Corrigir as 5 conexões RD com erro de sincronização

### Por que quarto
Cinco conexões têm erro ativo. Elas precisam ser investigadas individualmente.

### Ações (uma por conta)

#### 4a. CA01 - DRA NATÁLIA BARRAGÃO — `canceling statement due to statement timeout`
- Investigar queries lentas no Supabase para essa conta
- Verificar se há funis com muitos deals causando timeout
- Aplicar otimização de query ou paginação menor

#### 4b. CA02 - DRO JOSÉ HENRIQUE — `Sincronização RD partial.` (últimos 11 dias)
- Reexecutar sync histórico para processar páginas restantes
- Verificar cursor de paginação

#### 4c. CA01 - DRO JOSÉ HENRIQUE — `Sincronização RD partial.` (últimos 10 dias)
- Mesma ação que 4b

#### 4d. CA02 - DRA RANNIELY SILVA — `Sincronização RD partial.` (últimos 2 dias)
- Mesma ação que 4b

#### 4e. CA01 - DRA RANNIELY SILVA — `TimeoutError: Supabase request timed out` (19 dias)
- Investigar timeout no Supabase para essa conta
- Verificar se há deadlock ou query pesada

### Critérios de aceitação
- Todas as 5 conexões têm status de sucesso (não "Erro de sincronização")
- Último sucesso é recente (menos de 24h)

---

## Ataque 5 — Revisar vinculação dos 17 funis RD

### Por que quinto
Funis de Ranniely estão vinculados à conta da Natália e vice-versa, causando contaminação de dados.

### Ações
1. Em `/integracoes` → aba "CRM & Vendas" → seção "Funis RD"
2. Para cada um dos 17 funis, verificar se a "Conta Meta" selecionada no combobox corresponde ao titular do funil
3. Corrigir os combobox que apontam para conta errada
4. Verificar que não há funil vinculado a conta de titular diferente

### Critérios de aceitação
- Cada funil está vinculado à conta Meta do mesmo titular
- Nenhum funil de "Ranniely" está vinculado a conta de "Natália" e vice-versa

---

## Ataque 6 — Executar jobs automáticos nunca rodados

### Por que sexto
Sem jobs automáticos, a reconciliação e enriquecimento não acontecem sozinhos.

### Ações
1. Em `/saude-dos-dados` → seção "Jobs automáticos"
2. Clicar em "Executar agora" em:
   - Reconciliação vendas ↔ RD
   - Enriquecimento de estados
   - Retry sync Meta
3. Verificar que cada job executa com sucesso

### Critérios de aceitação
- Todos os 3 jobs têm data de execução preenchida (não "nunca")
- Nenhum job falha na execução

---

## Ataque 7 — Corrigir deals sem estado (2.744 deals, 32% de 8.566)

### Por que sétimo
Deals sem estado não aparecem corretamente no funil e contaminam as contagens.

### Ações
1. Em `/saude-dos-dados` → clicar em "Enriquecer estados via RD (200)"
2. Verificar que o número de "Deals sem estado" diminui
3. Repetir até zerar ou estabilizar

### Critérios de aceitação
- "Deals sem estado" reduzido significativamente (meta: < 5% do total)

---

## Ataque 8 — Renovar token do Instagram Business (expirado desde 14/10/2026)

### Por que oitavo
Token expirado impede sincronização de dados do Instagram.

### Ações
1. Em `/saude-dos-dados` → seção "Tokens, expiração e permissões OAuth"
2. Renovar o token do "instagram business" (status: expired, expira 14/10/2026)
3. Verificar que o status muda para "healthy" ou pelo menos não "expired"

### Critérios de aceitação
- Token do Instagram Business não está mais como "expired"

---

## Ataque 9 — Corrigir campanhas com spend sem leads (4 campanhas)

### Por que nono
Campanhas gastam dinheiro sem gerar leads, indicando problema de configuração ou objetivo errado.

### Ações
1. Em `/saude-dos-dados` → seção "Campanhas com spend sem leads"
2. Para cada uma das 4 campanhas listadas, investigar:
   - Objetivo da campanha (TRAFFIC vs LEADS)
   - action_type configurado
   - Se o pixel/Conversions API está instalado corretamente
3. Ajustar campanhas que têm objetivo errado para leads

### Critérios de aceitação
- Nenhuma campanha com spend > R$50 e 0 leads nos últimos 30 dias (ou justificativa documentada)

---

## Ataque 10 — Validar reconciliação Meta ↔ RD

### Por que décimo
Garantir que os totais salvos batem com a API do Meta Ads.

### Ações
1. Em `/saude-dos-dados` → seção "Reconciliação Meta"
2. Selecionar período (ex: 15/11/2026 → 16/11/2026)
3. Clicar em "Validar"
4. Corrigir divergências encontradas

### Critérios de aceitação
- Validação executada sem erro
- Divergências entre Growdash e Graph API corrigidas ou documentadas

---

## Ordem de execução recomendada

| Ordem | Ataque | Prioridade | Tempo estimado |
|-------|--------|------------|----------------|
| 1 | Promover código para produção | Crítico | 5 min |
| 2 | Aplicar migration no Supabase | Crítico | 15 min |
| 3 | Sincronizar 2 contas nunca sync | Alto | 10 min |
| 4 | Corrigir 5 contas com erro | Alto | 30 min |
| 5 | Revisar 17 funis RD | Médio | 20 min |
| 6 | Executar jobs automáticos | Médio | 10 min |
| 7 | Corrigir deals sem estado | Médio | 15 min |
| 8 | Renovar token Instagram | Baixo | 5 min |
| 9 | Corrigir campanhas sem leads | Baixo | 30 min |
| 10 | Validar reconciliação Meta | Baixo | 10 min |

---

## Como usar este prompt

A cada ataque:
1. Leia a seção correspondente
2. Execute as ações listadas na ordem
3. Verifique os critérios de aceitação
4. Marque como concluído e passe para o próximo
5. Se algum ataque falhar, pare e investigue antes de continuar

Não pule ataques. Não execute múltiplos ataques em paralelo que tocam nos mesmos dados (ex: não execute ataque 3 e 4 simultaneamente na mesma conta).
