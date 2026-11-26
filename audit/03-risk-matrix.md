# Matriz de Risco e Ordem de Execução — Backend Growdash

Data: 2026-11-05 | Auditor: Claude Opus 5 (Engenheiro Principal)
Fonte: `/audit/01-backend-findings.md` (16 achados)

Critério de ordenação (briefing, seção 6): vazamento de dado primeiro → bypass de acesso segundo →
instabilidade terceiro → custo quarto → higiene por último.

---

## Tabela de Prioridade

| # | ID | Sev. | Área | Impacto no negócio | Esforço | Dependência | Lote |
|---|---|---|---|---|---|---|---|
| 1 | GRO-SEC-001 | ALTO | Autorização | Vazamento cross-tenant: dados financeiros de um workspace aparecem em outro | P | — | **L1** |
| 2 | GRO-INT-001 | ALTO | Segredos | Token de API de terceiro lido por usuário autenticado; uso não auditado | G | — | **L4** |
| 3 | GRO-AI-002 | ALTO | IA/MCP | Agente entrega dado de recurso que o usuário perdeu acesso | M | GRO-SEC-001 | **L2** |
| 4 | GRO-SEC-004 | MÉDIO | Superfície | Service key do banco trafega como credencial de chamada | M | — | **L2** |
| 5 | GRO-SEC-002 | MÉDIO | Autorização | Rate limit público zerável por requisição anônima | P | — | **L1** |
| 6 | GRO-SEC-003 | MÉDIO | Autorização | Lead gravado em tenant divergente do endpoint | P | — | **L1** |
| 7 | GRO-SEC-006 | MÉDIO | Autorização | Tabela `private` exposta via anon (conteúdo a confirmar) | P | — | **L1** |
| 8 | GRO-SEC-005 | ALTO | Segredos | Host/IP/caminhos de produção no histórico git + senha `admin` | P | — | **L1** |
| 9 | GRO-OBS-001 | MÉDIO | Observabilidade | Falha de backend invisível; release Sentry sem eventos | G | — | **L3** |
| 10 | GRO-OBS-002 | MÉDIO | Observabilidade | Diagnóstico de incidente sem correlação entre logs | G | — | **L3** |
| 11 | GRO-OBS-004 | MÉDIO | Observabilidade | Queda de login sem alerta | M | GRO-OBS-001 | **L3** |
| 12 | GRO-AI-001 | MÉDIO | IA | Custo de API por requisição sem teto; gasto imprevisível | M | — | **L2** |
| 13 | GRO-OBS-003 | MÉDIO | Integrações | Re-sync RD duplica negócios e distorce receita | M | — | **L2** |
| 14 | GRO-PERF-002 | MÉDIO | Superfície | Chamada de IA ilimitada por usuário; custo e carga descontrolados | G | GRO-SEC-004 | **L5** |
| 15 | GRO-PERF-001 | MÉDIO | Performance | Reconciliação_rd cresce linearmente com todos os tenants | M | — | **L5** |
| 16 | GRO-DATA-001 | BAIXO | Dados | Exclusão de pai bloqueada por FK sem `ON DELETE` | GG | — | **L6** |
| 17 | GRO-AI-003 | BAIXO | IA/RAG | Regressão de retrieval não detectada | M | — | **L6** |

---

## Lotes de Execução

| Lote | Objetivo | Achados | Esforço total | Portão de saída |
|---|---|---|---|---|
| **L1** | Fechar vazamentos de tenant e expor segredos | GRO-SEC-001, 002, 003, 005, 006 | P (≈2h somando correções de migration) | Nenhum dado de um tenant visível a outro; nenhum host de produção em arquivo versionado |
| **L2** | Endurecer barreira de acesso, custo de IA e idempotência | GRO-AI-002, GRO-SEC-004, GRO-AI-001, GRO-OBS-003 | M+M+M+M (≈4 dias) | Service key não trafega como credencial; `max_tokens` presente; sync RD idempotente |
| **L3** | Restaurar observabilidade | GRO-OBS-001, 002, 004 | G+G+M (≈9 dias) | Erro de função chega ao Sentry com release; todo request tem `request_id`; alerta de 5xx configurado |
| **L4** | Blindar credenciais de terceiro | GRO-INT-001 | G (2-5 dias) | `authenticated` não lê coluna de credencial; tokens rotacionados |
| **L5** | Controlar custo e latência | GRO-PERF-002, GRO-PERF-001 | G+M (≈6 dias) | 429 em abuso de IA; reconciliação_rd com janela temporal |
| **L6** | Higiene de dados e avaliação de IA | GRO-DATA-001, GRO-AI-003 | GG+M | Constraints com `ON DELETE` decidido por tabela; fixtures de retrieval |

---

## Decisões Tomadas Durante a Auditoria

1. **GRO-SEC-001 fica no topo mesmo sendo P.** É o único achado com caminho comprovado de vazamento entre tenants (dados financeiros). Custo baixo, impacto alto.
2. **GRO-SEC-005 entra no L1 despite ser só documentação.** A senha `admin` está no histórico git e a rotação só foi aplicada no ambiente de produção. Remover o host do documento sem rotacionar a senha em todos os ambientes seria correção falsa.
3. **GRO-OBS-001 precede GRO-OBS-004.** Alerta sem SDK é impossível; a ordem está invertida na matriz por dependência real.
4. **GRO-PERF-002 depende de GRO-SEC-004.** O rate limit precisa distinguir caller interno de usuário final, e essa distinção nasce da troca da service key por segredo de escopo.
5. **GRO-DATA-001 é o último.** Exige decisão explícita por tabela (CASCADE destrutivo vs SET NULL); automatizar antes das decisões de negócio seria erro.

---

## Itens Fora do Escopo (Backend) Requerendo Decisão do Produto

| Item | Origem | Por que não é decisão técnica |
|---|---|---|
| Política de retenção de PII em logs, base e knowledge | GRO-OBS-001, GRO-SEC-005 | Prazo legal (LGPD) depende do negócio |
| Direito ao esquecimento como operação atômica | Seção 3.10 | Envolve，取消 de contratos e financeiro |
| Billing real (hoje é `BusinessUnavailablePage`) | Fluxo (i) | Decisão comercial de plano, preço e cobrança |
| Realtime vs batch para sync do RD | GRO-PERF-001 | Trade-off entre custo de API do provedor e frescor do dado |
| Granularidade do rate limit de IA | GRO-PERF-002 | Depende do plano contratado por tenant |
