import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  ChevronDown,
  ImagePlus,
  PencilLine,
  Globe,
  Plus,
  Mic,
  AudioLines,
  ArrowUp,
  FileText,
  AlertTriangle,
} from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { useSSD } from "@/lib/ssd/SSDContext";
import { retrieve } from "@/lib/ssd/retriever";
import type { ChatMessage, Thread } from "@/lib/ssd/threads";
import { cn } from "@/lib/utils";

const QUICK = [
  { label: "Resuma o que tem no SSD", icon: PencilLine },
  { label: "Encontre algo específico", icon: Globe },
  { label: "Descreva uma imagem", icon: ImagePlus },
];

interface Props {
  thread: Thread;
}

export function ChatWindow({ thread }: Props) {
  const { threadId } = useParams();
  const { appendMessage, updateLastAssistant, index } = useSSD();
  const [status, setStatus] = useState<"ready" | "submitted" | "streaming">("ready");
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const messages = thread.messages;
  const isEmpty = messages.length === 0;

  useEffect(() => {
    const id = window.setTimeout(() => textareaRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [threadId]);

  const send = async (text: string) => {
    if (!text.trim() || !threadId) return;
    setInput("");

    // 1. Local retrieval against the SSD index.
    const hits = retrieve(index, text.trim(), 6);
    const sources = Array.from(new Set(hits.map((h) => h.chunk.path)));

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
      createdAt: Date.now(),
    };
    await appendMessage(threadId, userMsg);
    setStatus("submitted");

    await new Promise((r) => setTimeout(r, 300));
    const assistant: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      createdAt: Date.now(),
    };
    await appendMessage(threadId, assistant);
    setStatus("streaming");

    // 2. Simulated response (real model will be plugged when Cloud is enabled).
    const preview = hits
      .slice(0, 3)
      .map(
        (h, i) =>
          `${i + 1}. **${h.chunk.path}** — ${h.chunk.text.slice(0, 180).trim()}…`,
      )
      .join("\n\n");

    const fullReply = hits.length
      ? `Encontrei ${hits.length} trechos relevantes no SSD sobre **"${text.trim()}"**:\n\n${preview}\n\n---\n*A IA generativa ainda não está plugada (sem créditos). Assim que você liberar, eu passo estes trechos + sua pergunta pro modelo e devolvo uma resposta sintetizada.*`
      : `Não encontrei nada relacionado a **"${text.trim()}"** nos documentos indexados. Você já rodou "Indexar" no menu lateral após colocar arquivos em \`docs/\`?`;

    let acc = "";
    for (const chunk of fullReply.match(/.{1,4}/gs) ?? []) {
      acc += chunk;
      await updateLastAssistant(threadId, acc, sources);
      await new Promise((r) => setTimeout(r, 8));
    }
    setStatus("ready");
    window.setTimeout(() => textareaRef.current?.focus(), 30);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (status !== "ready") return;
    void send(input);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (status === "ready") void send(input);
    }
  };

  const rendered = useMemo(() => messages, [messages]);
  const noIndex = !index || index.chunkCount === 0;

  const Composer = (
    <form
      onSubmit={onSubmit}
      className={cn(
        "group relative flex w-full items-end gap-2 rounded-[28px] border border-[#d4a94a]/20 bg-[#111]/80 px-3 py-2.5 shadow-[0_8px_40px_-12px_rgba(212,169,74,0.25)] backdrop-blur",
        "focus-within:border-[#d4a94a]/50 focus-within:shadow-[0_10px_50px_-10px_rgba(212,169,74,0.4)]",
      )}
    >
      <button
        type="button"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-400 transition hover:bg-white/5 hover:text-neutral-100"
        aria-label="Adicionar"
      >
        <Plus className="h-5 w-5" />
      </button>
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        rows={1}
        placeholder="Pergunte alguma coisa sobre o conteúdo do SSD"
        className="max-h-40 flex-1 resize-none bg-transparent px-1 py-2 text-[15px] leading-6 text-neutral-100 placeholder:text-neutral-500 focus:outline-none"
      />
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 transition hover:bg-white/5 hover:text-neutral-100"
          aria-label="Ditar"
        >
          <Mic className="h-4 w-4" />
        </button>
        {input.trim() ? (
          <button
            type="submit"
            disabled={status !== "ready"}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#f4d47a] via-[#d4a94a] to-[#8a6a1f] text-black shadow-[0_0_20px_-4px_rgba(212,169,74,0.6)] transition hover:brightness-110 disabled:opacity-50"
            aria-label="Enviar"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 transition hover:bg-white/5 hover:text-neutral-100"
            aria-label="Voz"
          >
            <AudioLines className="h-4 w-4" />
          </button>
        )}
      </div>
    </form>
  );

  return (
    <div className="flex h-screen min-w-0 flex-1 flex-col bg-[#050505]">
      <header className="flex h-14 items-center justify-between px-4 md:px-6">
        <button className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-neutral-200 hover:bg-white/5">
          <span className="bg-gradient-to-r from-[#f4d47a] to-[#d4a94a] bg-clip-text text-transparent">Grow</span>dash AI
          <ChevronDown className="h-4 w-4 opacity-70" />
        </button>
        <div className="flex items-center gap-2 text-[11px] text-neutral-500">
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            SSD ativo
          </span>
        </div>
      </header>

      {noIndex && (
        <div className="mx-auto mt-1 flex w-full max-w-3xl items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-[12px] text-amber-200/90">
          <AlertTriangle className="h-3.5 w-3.5" />
          Nenhum documento indexado ainda. Coloque arquivos em <code className="mx-1 rounded bg-black/40 px-1">docs/</code> e clique em <b>Indexar</b> no menu lateral.
        </div>
      )}

      {isEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <h1 className="mb-10 text-center text-3xl font-medium tracking-tight text-neutral-100 md:text-[32px]">
            Tudo pronto? Então vamos lá!
          </h1>
          <div className="w-full max-w-3xl">{Composer}</div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {QUICK.map(({ label, icon: Icon }) => (
              <button
                key={label}
                onClick={() => send(label)}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-[#111]/70 px-4 py-2 text-sm text-neutral-300 backdrop-blur transition hover:border-[#d4a94a]/40 hover:text-neutral-100"
              >
                <Icon className="h-4 w-4 text-[#d4a94a]" />
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <Conversation className="flex-1">
            <ConversationContent className="mx-auto w-full max-w-3xl px-4">
              {rendered.map((m) => (
                <Message key={m.id} from={m.role}>
                  {m.role === "assistant" ? (
                    <div className="w-full max-w-full">
                      <MessageContent className="prose prose-sm dark:prose-invert max-w-none">
                        {m.content ? <MessageResponse>{m.content}</MessageResponse> : <Shimmer>Buscando no SSD</Shimmer>}
                      </MessageContent>
                      {m.sources && m.sources.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5 px-4">
                          {m.sources.map((src) => (
                            <span
                              key={src}
                              className="inline-flex items-center gap-1 rounded-full border border-[#d4a94a]/25 bg-[#d4a94a]/5 px-2 py-0.5 text-[10.5px] text-[#f4d47a]"
                            >
                              <FileText className="h-3 w-3" />
                              {src}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <MessageContent>{m.content}</MessageContent>
                  )}
                </Message>
              ))}
              {status === "submitted" && (
                <Message from="assistant">
                  <MessageContent>
                    <Shimmer>Buscando no SSD</Shimmer>
                  </MessageContent>
                </Message>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div className="mx-auto w-full max-w-3xl px-4 pb-5 pt-2">
            {Composer}
            <p className="mt-2 text-center text-[11px] text-neutral-500">
              Respostas geradas 100% a partir dos arquivos do seu SSD.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
