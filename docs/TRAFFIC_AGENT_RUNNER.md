# Traffic Agent local

O runner local mantém um navegador persistente aberto no computador do proprietário e envia heartbeat para a Growdash. A análise é executada às 08:00 e 14:00 no fuso `America/Sao_Paulo`; uma análise adicional pode ser disparada pelo botão **Analisar agora**.

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

O runner abre o Ads Manager, envia heartbeat a cada minuto e atualiza a tela **Gestor autorizado**. Se o computador desligar, o painel mostra o agente como offline após cinco minutos sem heartbeat.

## Modo de aprovação obrigatória

- O gestor analisa de forma autônoma, mas o perfil padrão é `approval_required`.
- Ele pode recomendar pausa de conjuntos com gasto mínimo e zero oportunidades/vendas, ou aumento de orçamento em 10% quando já existem vendas no RD e ROAS comercial acima da meta.
- Cada recomendação é gravada em `traffic_action_proposals` e auditada em `traffic_action_audit`.
- Somente uma aprovação explícita do proprietário muda a proposta para `approved`; o banco rejeita qualquer execução sem essa aprovação.
- Captcha, sessão expirada, rate limit, token ausente e divergência Meta/RD bloqueiam a operação.
- O navegador permanece aberto para observação; a escrita usa a API oficial da Meta no backend para evitar cliques frágeis.
