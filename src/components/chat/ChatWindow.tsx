import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { ChevronDown, ImagePlus, PencilLine, Globe, Plus, Mic, AudioLines, ArrowUp } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { useThreads } from "@/hooks/useThreads";
import type { ChatMessage, Thread } from "@/lib/threads";
import { cn } from "@/lib/utils";

const QUICK = [
  { label: "Crie uma imagem", icon: ImagePlus },
  { label: "Escreva ou edite", icon: PencilLine },
  { label: "Consulte algo", icon: Globe },
];

interface Props {
  thread: Thread;
}

export function ChatWindow({ thread }: Props) {
  const { threadId } = useParams();
  const { appendMessage, updateLastAssistant } = useThreads();
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
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
      createdAt: Date.now(),
    };
    appendMessage(threadId, userMsg);
    setStatus("submitted");

    await new Promise((r) => setTimeout(r, 500));
    const assistant: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      createdAt: Date.now(),
    };
    appendMessage(threadId, assistant);
    setStatus("streaming");

    const fullReply = `Esta é uma resposta simulada. Quando quiser plugar um modelo real (por exemplo via Lovable AI Gateway), é só me pedir.\n\n**Você disse:** ${text.trim()}`;
    let acc = "";
    for (const chunk of fullReply.match(/.{1,4}/gs) ?? []) {
      acc += chunk;
      updateLastAssistant(threadId, acc);
      await new Promise((r) => setTimeout(r, 15));
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
        placeholder="Pergunte alguma coisa"
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
      {/* Header */}
      <header className="flex h-14 items-center justify-between px-4 md:px-6">
        <button className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-neutral-200 hover:bg-white/5">
          <span className="bg-gradient-to-r from-[#f4d47a] to-[#d4a94a] bg-clip-text text-transparent">Grow</span>dash AI
          <ChevronDown className="h-4 w-4 opacity-70" />
        </button>
        <div className="flex items-center gap-2">
          <button className="rounded-full bg-gradient-to-r from-[#f4d47a] via-[#d4a94a] to-[#8a6a1f] px-3 py-1.5 text-xs font-semibold text-black shadow-[0_0_16px_-4px_rgba(212,169,74,0.55)] hover:brightness-110">
            ✨ Fazer upgrade
          </button>
        </div>
      </header>

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
                onClick={() => send(label + ": ")}
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
                    <MessageContent className="prose prose-sm dark:prose-invert max-w-none">
                      {m.content ? <MessageResponse>{m.content}</MessageResponse> : <Shimmer>Pensando</Shimmer>}
                    </MessageContent>
                  ) : (
                    <MessageContent>{m.content}</MessageContent>
                  )}
                </Message>
              ))}
              {status === "submitted" && (
                <Message from="assistant">
                  <MessageContent>
                    <Shimmer>Pensando</Shimmer>
                  </MessageContent>
                </Message>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div className="mx-auto w-full max-w-3xl px-4 pb-5 pt-2">
            {Composer}
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Growdash AI pode cometer erros. Verifique informações importantes.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
