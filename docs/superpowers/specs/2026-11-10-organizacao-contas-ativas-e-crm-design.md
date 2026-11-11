# Design: Organização de Contas Ativas (Tráfego Pago, CRM & Vendas)

**Data:** 10/11/2026  
**Branch:** `feature/filtro-contas-ativas-integracoes-crm`  
**Status:** Proposto ao usuário via brainstorming  

---

## 1. Contexto e Problema

O usuário relatou:
> *"Minha parte de integração de trafego pago e crm & venda esta tudo uma bagunça me ajuda a organizar isso, eu quero que apareça para mim apenas as que eu ativar na plataforma"*

### O que está acontecendo por trás:
1. **27 contas Meta cadastradas**, mas apenas **7 ativas**. As 20 desativadas ocupam espaço no grid de Integrações e vazam para outros módulos se tiverem algum histórico.
2. **24 funis do RD Station**, mas apenas **6** com conta Meta válida. Os outros **18** estão órfãos (ligados a conexões antigas de contas Meta que não existem mais) e por isso **nunca aparecem no CRM**.
3. **CRM sem indicação clara da conta**: o usuário não sabia qual conta estava sendo exibida, e negociações de contas diferentes apareciam misturadas quando nenhuma conta estava filtrada no topo.
4. **Seletor de conta hoje permite multi-seleção** (marcar várias caixinhas), o que confunde o usuário que quer ver **uma conta por vez** com foco total.

---

## 2. Decisões do Usuário (Brainstorming)

1. **Modo de seleção de conta:** **Uma por vez** (estilo rádio: você clica em "Dra. Ranniely" e vê só ela; ou escolhe "Todas as contas ativas"). Sem misturar caixinhas.
2. **Alcance da seleção:** **Plataforma inteira**. A conta escolhida na barra do topo vale para Dashboard, Análise de Funis, Tráfego Pago, CRM e Vendas.
3. **Funil do RD Station:** **Automático pela conta**. Ao selecionar a conta Meta, a Growdash pega automaticamente os funis RD vinculados a ela. O usuário não precisa ficar marcando funil na mão.
4. **Onde o seletor fica:** **Na barra do topo**. No CRM, exibe-se apenas uma faixa informativa limpa (`Conta ativa: Dra. Ranniely Silva · Funis: Aluna, Paciente Modelo`), sem duplicar o controle e sem poluir o visual.
5. **Comportamento ao desativar conta em Integrações:** **Some na hora** de todas as telas (Tráfego Pago, CRM, Vendas). O histórico fica no banco para auditoria, mas a conta não aparece em nenhum menu ou gráfico.
6. **Resolução dos 18 funis órfãos:** **O usuário indica e eu ligo** no banco para a conta Meta correta.

---

## 3. O que será implementado

### 3.1. Tela de Integrações (`src/growdash/IntegrationsPage.tsx`)
- **Filtro de Contas Meta por Status:**
  - Botões/pills visíveis no topo do card Meta Ads:
    - `[ Apenas Ativas (7) ]` *(padrão)*
    - `[ Todas (27) ]`
    - `[ Desativadas (20) ]`
  - Ao clicar em "Apenas Ativas", a grade de 3 colunas esconde todas as 20 contas desativadas, limpando a visualização.
  - Na sanfona "Conexões RD por conta", aplica o mesmo filtro: somente contas ativas aparecem quando o filtro estiver ativo.
- **Vínculo individual por funil (já implementado na etapa anterior):** cada funil RD tem o dropdown da Conta Meta para troca com 1 clique.

### 3.2. Barra Global de Escopo (`AccountMultiSelect.tsx` / `GlobalScopeToolbar.tsx`)
- Modo **Seleção Única** ativado:
  - O popover agora permite escolher **uma conta de cada vez** com clique direto (ou "Todas as contas ativas").
  - Ao clicar numa conta, seleciona apenas ela imediatamente, sem precisar desmarcar as outras.
  - Apenas contas com `connection_status !== "disconnected"` aparecem na lista.

### 3.3. CRM (`src/growdash/CrmPage.tsx`)
- A faixa de filtros do CRM (`crm-filter-strip`) fica limpa:
  - Exibe chip informativo com a conta Meta selecionada no topo e os funis do RD automaticamente resolvidos.
  - Apenas as negociações daquela conta e de seus funis correspondentes são carregadas e exibidas no Kanban e na Lista.
  - Se "Todas as contas ativas" for selecionada, o CRM exibe o consolidado das 7 contas ativas, sem incluir nenhuma das 20 desativadas.

### 3.4. Tráfego Pago (`TrafficPage.tsx` / `Campaigns.tsx`) e Vendas (`FinancePage.tsx`)
- Garantir que `visibleAccounts` e `adAccounts` usem a regra estrita `connection_status !== "disconnected"` para que contas desativadas sumam imediatamente de Tráfego Pago e Vendas.

---

## 4. O que NÃO será feito (Não-objetivos)
- Não será alterada nenhuma tabela do banco além de vínculos já permitidos (`rd_funnels.ad_account_id`).
- Não será apagado nenhum dado histórico de negociações ou métricas das contas desativadas (preservação para auditoria).
- Não será duplicado o seletor de contas dentro da tela do CRM (decisão: fica apenas no topo).

---

## 5. Próximo Passo Imediato

O usuário listará quais contas pertencem aos funis que ele quer ativos, e o código da branch será finalizado e testado.
