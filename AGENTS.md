# Fluxo obrigatório de alteração e validação

Antes de implementar ou diagnosticar qualquer alteração na Growdash, seguir esta ordem e registrar as evidências relevantes:

1. **Código local:** verificar árvore Git, diff, arquivos relacionados e testes locais aplicáveis.
2. **GitHub/remoto:** consultar branch atual, `git fetch` e divergência com `origin/main`; não assumir que o checkout local é a versão publicada.
3. **Cloudflare Pages:** conferir o deployment de produção ativo, URL e hash/commit de origem; confirmar que os assets servidos pertencem à versão esperada.
4. **Navegador:** somente depois das três verificações anteriores, abrir a rota autenticada e testar o fluxo afetado. Ler o console e a interface após cada reload/navegação.

Após uma correção, validar localmente, criar commit, enviar ao GitHub, publicar no Cloudflare e então repetir as verificações de Cloudflare e navegador. Nunca declarar produção validada enquanto o domínio principal estiver servindo HTML ou chunks de uma versão anterior.
