# Operação do Loop Engineering

O loop executa verificações sequenciais e produz um relatório sanitizado. Ele
não interpreta uma falha como ausência de dados e não publica alterações por
acidente.

## Modos

```bash
npm run loop-engineering:detect
node scripts/loop-engineering.mjs --mode detect --output reports/loop-engineering.json
node scripts/loop-engineering.mjs --mode repair --plan caminho/plano.json
node scripts/loop-engineering.mjs --mode release --plan caminho/plano.json
```

`detect` roda testes, lint, build, smoke visual e `git diff --check`. No CI,
`LOOP_ENGINEERING_BACKEND_SCAN=1` também inspeciona Edge Functions e bloqueia
consultas Supabase que descartam erros. `repair` e `release`
exigem um plano declarativo; sem plano o resultado é bloqueado. O runner nunca
executa shell arbitrário: somente comandos allowlistados e arquivos declarados.
Cada relatório usa lock e escrita atômica; uma execução concorrente é bloqueada
para não sobrescrever evidências.

## Plano de remediação

Um plano para alterar RLS, permissões, autenticação, webhooks, callbacks,
secrets ou métricas financeiras deve declarar a causa reproduzida, assinaturas
dos achados, arquivos/migrations, testes, escopo, snapshot/backup, rollback e
condições de abortar. Sem esses campos não há alteração parcial.

As assinaturas precisam corresponder exatamente a achados reproduzidos na mesma
execução; curingas como `*` são rejeitados. Depois de aplicar um patch, cada
teste declarado é executado novamente. Se algum teste falhar ou expirar, os
arquivos alterados são restaurados e o relatório fica `blocked`.

## Relatórios

O JSON e o Markdown ficam em `reports/` e são ignorados pelo Git. O relatório
contém commit, modo, status, assinatura deduplicada, evidência sanitizada,
reprodução, remediação, validação e decisão de release. Tokens, cookies,
authorization headers, senhas e query parameters sensíveis são substituídos por
`[REDACTED]`.

## CI

`.github/workflows/loop-engineering.yml` executa o modo `detect` a cada três
horas e manualmente. O artefato é preservado por 14 dias. O job falha quando o
gate encontra uma regressão, mas não faz deploy. Publicação exige uma execução
`release` validada, revisão do diff e os gates de Cloudflare/Supabase descritos
em `AGENTS.md`.

O scan local de backend é estático e preventivo: ele registra o arquivo e a
linha para revisão, mas não reescreve Edge Functions por inferência. Correções
automáticas só usam planos declarativos com pré-condição, teste pós-patch,
snapshot e rollback.

## Leitura do resultado

- `detected`: checks concluídos sem achados.
- `blocked`: há falha ou risco que precisa ser corrigido/validado.
- `eligible`: somente gates de release; árvore, origem, manifesto e testes estão
  aprovados.

Timeout, erro de rede, integração indisponível e carregamento pendente são
sempre evidenciados como falha/indisponibilidade; nunca são convertidos em zero
ou `empty_confirmed`.
