import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { useThreads } from "@/hooks/useThreads";
import type { ChatMessage, Thread } from "@/lib/threads";
import logo from "@/assets/chat-logo.png";

const SUGGESTIONS = [
  "Explique computação quântica de forma simples",
  "Escreva um email profissional recusando uma reunião",
  "Ideias de projetos para aprender TypeScript",
  "Resuma o livro Sapiens em 5 tópicos",
];

interface Props {
  thread: Thread;
}

export function ChatWindow({ thread }: Props) {
  const { threadId } = useParams();
  const { appendMessage, updateLastAssistant } = useThreads();
  const [status, setStatus] = useState<"ready" | "submitted" | "streaming">("ready");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const messages = thread.messages;
  const isEmpty = messages.length === 0;

  useEffect(() => {
    // refocus on thread switch
    const id = window.setTimeout(() => textareaRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [threadId]);

  const send = async (text: string) => {
    if (!text.trim() || !threadId) return;
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
      createdAt: Date.now(),
    };
    appendMessage(threadId, userMsg);
    setStatus("submitted");

    // placeholder assistant streaming simulation
    await new Promise((r) => setTimeout(r, 500));
    const assistant: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      createdAt: Date.now(),
    };
    appendMessage(threadId, assistant);
    setStatus("streaming");

    const fullReply = `Esta é uma resposta simulada. A interface está pronta — quando quiser plugar um modelo real (por exemplo, via Lovable AI Gateway), é só me pedir.\n\n**Você disse:** ${text.trim()}`;
    let acc = "";
    for (const chunk of fullReply.match(/.{1,4}/gs) ?? []) {
      acc += chunk;
      updateLastAssistant(threadId, acc);
      await new Promise((r) => setTimeout(r, 15));
    }
    setStatus("ready");
    window.setTimeout(() => textareaRef.current?.focus(), 30);
  };

  const handleSubmit = (msg: PromptInputMessage) => {
    if (status !== "ready") return;
    void send(msg.text ?? "");
  };

  const rendered = useMemo(() => messages, [messages]);

  return (
    <div className="flex h-screen min-w-0 flex-1 flex-col bg-background">
      <header className="flex h-14 items-center justify-between border-b border-border/60 px-4 md:px-6">
        <div className="truncate text-sm font-medium">{thread.title}</div>
        <div className="text-xs text-muted-foreground">Interface · sem backend</div>
      </header>

      {isEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <img src={logo} alt="" className="mb-4 h-16 w-16" />
          <h1 className="mb-1 text-2xl font-semibold tracking-tight">Como posso ajudar hoje?</h1>
          <p className="mb-8 text-sm text-muted-foreground">Comece uma conversa ou escolha uma sugestão</p>
          <div className="grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground/80 transition hover:border-foreground/30 hover:bg-accent"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <Conversation className="flex-1">
          <ConversationContent className="mx-auto w-full max-w-3xl">
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
      )}

      <div className="mx-auto w-full max-w-3xl px-4 pb-6 pt-2">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea ref={textareaRef} placeholder="Envie uma mensagem para Aria..." />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} disabled={status !== "ready"} />
          </PromptInputFooter>
        </PromptInput>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Aria pode cometer erros. Verifique informações importantes.
        </p>
      </div>
    </div>
  );
}
