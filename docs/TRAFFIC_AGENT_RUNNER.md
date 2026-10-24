# Traffic Agent local

O runner local mantém um navegador persistente aberto no computador do proprietário e envia heartbeat para a Growdash. A análise é executada às 08:00 e 15:00 no fuso `America/Sao_Paulo`; uma análise adicional pode ser disparada pelo botão **Analisar agora**.

## Configuração

Defina as variáveis somente na sessão local do computador autorizado:

```bash
export SUPABASE_URL="https://seu-projeto.supabase.co"
export TRAFFIC_AGENT_ACCESS_TOKEN="token-de-sessao-do-usuario"
export TRAFFIC_AGENT_PROFILE="/caminho/local/traffic-agent-profile"
```

O token é de sessão e não é gravado pelo runner. A primeira abertura do navegador deve ser autenticada manualmente na Meta; a sessão fica no perfil persistente local. Não coloque senha ou token Meta no repositório.

## Execução

```bash
npm run traffic-agent
```

O runner abre o Ads Manager, envia heartbeat a cada minuto e atualiza a tela **Gestor autorizado**. A análise agendada percorre todas as contas Meta autorizadas pelo usuário. Se o computador desligar, o painel mostra o agente como offline após cinco minutos sem heartbeat.

## Operação autônoma com guardrails

- O motor de Growth Engine analisa, gera, revisa, publica e avalia testes em conjunto separado quando `auto_publish_enabled` está ativo.
- O perfil `dry_run` mantém apenas diagnóstico. `autonomous_guarded` e `autonomous_full` continuam sujeitos aos bloqueios de frescor, atribuição, política, verba, token e confirmação da Meta.
- Ele pode recomendar pausa de conjuntos com gasto mínimo e zero oportunidades/vendas, ou aumento de orçamento em 10% quando já existem vendas no RD e ROAS comercial acima da meta.
- Ações legadas são gravadas em `traffic_action_proposals` e auditadas em `traffic_action_audit`; elas permanecem separadas do fluxo autônomo de experimentos.
- Cada mutação do Growth Engine é registrada em `growth_decisions`, `growth_budget_ledger` e `rollback_state`.
- Captcha, sessão expirada, rate limit, token ausente e divergência Meta/RD bloqueiam a operação.
- O navegador permanece aberto para observação; a escrita usa a API oficial da Meta no backend para evitar cliques frágeis.
