## O que vamos construir

Um "cérebro local no SSD": você aponta uma pasta do SSD externo, o app lê tudo que estiver lá dentro (docs + histórico de conversas), usa isso como **única** fonte de conhecimento pra responder, e grava as novas conversas de volta na mesma pasta. Nada de busca na web, nada de banco de dados externo — o SSD é a fonte da verdade.

## Como o SSD é acessado (limite do navegador)

Navegadores não montam disco. O jeito oficial é a **File System Access API** (Chrome, Edge, Brave, Arc, Opera — funciona no Safari só via fallback de upload). Fluxo:

1. Você clica em **"Conectar SSD"** → escolhe a pasta no SSD (ex: `/Volumes/MeuSSD/aria/`).
2. O navegador guarda essa permissão via IndexedDB. Nas próximas vezes o app pede só um clique de "reautorizar".
3. O app enxerga essa pasta como um sistema de arquivos: lê, escreve, cria subpastas.

Estrutura sugerida dentro da pasta escolhida:

```text
/Volumes/MeuSSD/aria/
├── docs/              ← seus arquivos de conhecimento (.md, .txt, .pdf, .json)
│   ├── growdash/
│   ├── processos/
│   └── ...
├── threads/           ← conversas salvas (uma por arquivo .json)
│   ├── 2026-07-06-planejamento.json
│   └── ...
└── index.json         ← índice de embeddings/chunks (gerado pelo app)
```

## Fluxo de mensagem (RAG local)

```text
Você digita → Client faz retrieval no índice local (top-K chunks relevantes)
            → Envia [pergunta + chunks + histórico] pra Edge Function
            → Edge Function chama Lovable AI Gateway (Gemini) com prompt travado:
              "Responda APENAS com base no contexto fornecido. Sem web."
            → Stream de volta pro chat
            → Client grava a conversa atualizada no arquivo .json do SSD
```

O SSD guarda os dados; o modelo (LLM) roda no gateway porque um LLM não cabe no navegador. Só os **trechos relevantes** de cada pergunta trafegam — o resto do acervo nunca sai do SSD.

## Etapas de implementação

**1. Backend (Lovable Cloud + Edge Function)**
- Ativar Lovable Cloud e garantir `LOVABLE_API_KEY`.
- Criar `supabase/functions/chat/index.ts`: recebe `{ messages, contextChunks }`, monta system prompt anti-web, chama `google/gemini-3-flash-preview` via AI SDK, devolve stream.
- Criar `supabase/functions/embed/index.ts`: recebe array de textos, devolve embeddings via `google/gemini-embedding-001` — usado só na hora de indexar arquivos novos.

**2. Camada de acesso ao SSD (`src/lib/ssd/`)**
- `handle.ts` — pede/salva o `FileSystemDirectoryHandle` no IndexedDB, reautorização automática.
- `fs.ts` — helpers: listar recursivamente `docs/`, ler .txt/.md/.json direto, extrair texto de .pdf com `pdfjs-dist`, escrever/ler `threads/*.json` e `index.json`.
- Toast + botão "Reconectar SSD" quando a permissão cair.

**3. Indexação (`src/lib/ssd/indexer.ts`)**
- Ao conectar o SSD (ou clicar "Reindexar"): varre `docs/`, quebra cada arquivo em chunks de ~800 chars, chama `embed` em batches, salva `index.json` com `{ path, chunk, embedding, hash }`.
- Detecção incremental por hash — não reembeda o que não mudou.

**4. Retrieval (`src/lib/ssd/retriever.ts`)**
- A cada pergunta: embeda a pergunta, faz similaridade coseno em memória contra `index.json`, devolve os top 6 chunks. Tudo no client.

**5. Threads no SSD (substitui localStorage)**
- Reescrever `src/hooks/useThreads.ts` pra ler/escrever de `threads/*.json` via handle do SSD.
- Fallback: se o SSD não está conectado, mostra tela vazia com CTA "Conectar SSD" em vez de criar thread solto.

**6. UI**
- Estado "SSD desconectado" no header: pill dourada "Conectar SSD".
- Estado "conectado": mostra caminho da pasta + contador de docs indexados + botão reindexar.
- No chat, mostrar as **fontes citadas** abaixo da resposta (arquivos que embasaram) — reforça a transparência do RAG.
- Manter identidade Growdash preta/dourada já aplicada.

**7. Streaming real**
- Trocar o `send()` simulado do `ChatWindow.tsx` por `useChat` do AI SDK apontando pra Edge Function `chat`.
- Persistir a conversa completa (user + assistant final) no arquivo do SSD dentro do `onFinish`.

## Detalhes técnicos

- **Bibliotecas novas:** `ai`, `@ai-sdk/react`, `@ai-sdk/openai-compatible`, `pdfjs-dist`, `idb-keyval` (persistir handle).
- **Segurança:** `LOVABLE_API_KEY` só na Edge Function; client nunca vê. Fetch de web fica desligado no system prompt.
- **Compatibilidade:** File System Access API não roda em Safari nem no iOS. Vou detectar e mostrar mensagem clara ("Use Chrome, Edge ou Brave") em vez de quebrar.
- **Modelo:** `google/gemini-3-flash-preview` (rápido, aceita contexto grande). Embeddings: `google/gemini-embedding-001` (3072 dims, cabe fácil no `index.json`).
- **Persistência do handle:** IndexedDB via `idb-keyval`. Chrome mantém permissão entre sessões desde que o usuário reautorize (uma tela clicada, sem re-selecionar pasta).
- **Não vamos:** subir arquivos pro Lovable Cloud, guardar embeddings no Postgres, nem indexar imagens/áudio nessa primeira versão (só texto e PDF).

## O que você vai poder fazer no fim

- Apontar o SSD, jogar todos os seus `.md`, `.txt`, `.pdf` dentro de `docs/`, dar "Reindexar".
- Conversar normalmente — o modelo responde citando SÓ o que está no SSD.
- Ver o histórico de conversas anteriores como threads (também vindos do SSD).
- Levar o SSD pra outro computador, conectar de novo, e retomar tudo do zero sem servidor.
