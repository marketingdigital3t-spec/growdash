# Fluxo obrigatório de alteração e validação

Antes de implementar ou diagnosticar qualquer alteração na Growdash, seguir esta ordem e registrar as evidências relevantes:

1. **Código local:** verificar árvore Git, diff, arquivos relacionados e testes locais aplicáveis.
2. **GitHub/remoto:** consultar branch atual, `git fetch` e divergência com `origin/main`; não assumir que o checkout local é a versão publicada.
3. **Cloudflare Pages:** conferir o deployment de produção ativo, URL e hash/commit de origem; confirmar que os assets servidos pertencem à versão esperada.
4. **Navegador:** somente depois das três verificações anteriores, abrir a rota autenticada e testar o fluxo afetado. Ler o console e a interface após cada reload/navegação.

Após uma correção, validar localmente, criar commit, enviar ao GitHub, publicar no Cloudflare e então repetir as verificações de Cloudflare e navegador. Nunca declarar produção validada enquanto o domínio principal estiver servindo HTML ou chunks de uma versão anterior.

## Regras de eficiência operacional

1. **Escopo estrito:** quando o usuário pedir um ajuste visual ou funcional pontual, focar exclusivamente na entrega desse ajuste. Se o CI, banco ou infraestrutura estiverem travados, avisar o usuário imediatamente com o diagnóstico e custo estimado — nunca expandir unilateralmente o escopo nem gastar tempo consertando problemas paralelos sem autorização explícita.
2. **Diagnóstico visual direto:** problemas visuais devem ser isolados em no máximo três medições via DevTools/Playwright (identificar elemento, regra que vence e causa raiz). Escrever teste automatizado, corrigir com a menor regra autoritativa possível e validar — sem turnar em auditorias históricas ou múltiplos testes de combinações desnecessárias.
3. **Migrations antes do commit:** nunca usar o runner do GitHub Actions como interpretador de erros SQL. Antes de commitar qualquer migration, verificar schemas existentes, nomes reais de colunas (usar blocos condicionais defensivos `IF EXISTS` quando apropriado) e qualificar extensões explicitamente com seu schema de instalação (ex.: `extensions.crypt`, `extensions.gen_random_bytes`).
