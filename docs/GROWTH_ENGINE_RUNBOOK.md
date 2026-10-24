# Growth Engine runbook

O runner executa o ciclo em `America/Sao_Paulo` e chama as funções nesta ordem:

1. `traffic-agent-analyze`
2. `growth-creative-generate`
3. `growth-experiment-run`
4. `growth-experiment-evaluate`
5. `traffic-agent-execute-approved` para legados aprovados

O ciclo cria snapshots Meta/RD, classifica fadiga, registra hipóteses idempotentes, gera variações a partir de assets aprovados, revisa claims, duplica o conjunto vencedor, reserva a verba no ledger, cria anúncios pausados, confirma o retorno da Meta e só então ativa o teste.

Cada teste usa 1× o CPL de referência, respeita o teto da conta, limita dois testes simultâneos e mede por 72 horas. O avaliador deve registrar `promoted`, `stopped`, `blocked` ou `rolled_back` em `growth_decisions`.

O botão de pausa global usa `set_growth_engine_mode`. `dry_run` cria diagnósticos e não publica. `autonomous_full` permite publicar somente quando todos os bloqueios forem resolvidos.

A fábrica usa somente assets aprovados. Imagens com `storage_path` são anexadas ao creative quando a URL assinada está disponível; variantes de vídeo ficam bloqueadas até que o upload de vídeo da Meta esteja configurado, evitando publicar uma peça diferente da aprovada.
