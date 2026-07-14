# Growdash — relatório de implementação

Data: 14/07/2026

## Entregue neste ciclo

- Fundação multi-tenant com workspace, membros e papéis.
- Unidades de negócio reais para Infoproduto e SaaS.
- Vínculo de contas Meta e vendas à unidade de negócio.
- Perfil completo com foto, telefone, cargo, identidade, e-mail, senha e aparência.
- Catálogo dos planos Starter, Growth, Scale e Agency com franquias explícitas.
- Assinatura e uso mensal separados do catálogo de planos.
- Central de integrações em oito categorias.
- Meta Ads e RD Station preservados e reorganizados com diagnóstico e sincronização.
- Configurações simplificadas; integrações técnicas removidas dessa tela.
- Financeiro com Resumo, DRE, Lançamentos, Fluxo de Caixa e Previsão.
- Lançamentos financeiros protegidos por RLS e papéis financeiros.
- Tabelas principais adaptadas para cards no mobile.
- Campanhas convertidas para tokens semânticos de tema claro/escuro.
- Compatibilidade temporária com o esquema anterior para evitar tela branca durante a migração.

## 10 melhorias adicionais aplicadas

1. Abas de Integrações persistidas na URL para abrir e compartilhar a seção certa.
2. Busca instantânea por provedor dentro da Central de Integrações.
3. Indicadores consolidados de saúde de Meta e RD.
4. Exibição de última sincronização em linguagem humana.
5. Reset seguro da conta global ao trocar para uma unidade que não possui aquela conta.
6. Validação de foto por formato e limite de 3 MB.
7. Senha nova com exigência mínima de 10 caracteres.
8. Exportação CSV financeira respeitando conta, período e unidade selecionados.
9. Previsão de seis meses com base móvel de 12 meses e aviso contra falsa precisão.
10. Estados vazios e fallback de esquema para impedir tela branca em implantação gradual.

## Validações executadas

- `npx tsc --noEmit`: aprovado.
- ESLint nos arquivos alterados: zero erros.
- Vitest: 6 de 6 testes aprovados.
- `npm run build`: aprovado.
- `git diff --check`: aprovado.

## Migração de banco

Arquivo preparado: `supabase/migrations/20260714210000_workspace_billing_finance_foundation.sql`.

O histórico remoto contém duas migrações ausentes nesta cópia local e várias migrações locais antigas não registradas no remoto. Por isso, `supabase db push` foi deliberadamente bloqueado: ele tentaria aplicar arquivos antigos em massa. A migração nova deve ser executada isoladamente no SQL Editor do projeto Supabase antes de publicar a versão de produção. Não reparar o histórico automaticamente sem uma reconciliação do esquema.

