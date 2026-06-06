import { useEffect, useState } from "react";
import type { ElementType } from "react";
import { Bot, BrainCircuit, Headphones, Loader2, Maximize2, MessageSquare, Send, TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Specialist = "traffic" | "sales" | "support";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const specialists: Record<Specialist, { label: string; icon: ElementType; system: string }> = {
  traffic: {
    label: "Tráfego Pago",
    icon: TrendingUp,
    system:
      "Vou analisar como estrategista de mídia paga: ROAS, CAC, CPL, escala, criativos, funil, orçamento e campanhas que precisam pausar.",
  },
  sales: {
    label: "Vendas",
    icon: MessageSquare,
    system:
      "Vou analisar como estrategista comercial: objeções, follow-up, WhatsApp, CRM, fechamento, recuperação e taxa de conversão.",
  },
  support: {
    label: "Suporte",
    icon: Headphones,
    system:
      "Vou analisar como especialista de suporte: uso da plataforma, integrações, erros operacionais, diagnósticos e próximos passos objetivos.",
  },
};

const initialMessages: Record<Specialist, ChatMessage[]> = {
  traffic: [
    {
      role: "assistant",
      content: "Sou a Growdash para Tráfego Pago. Me pergunte o que pausar, escalar, corrigir ou testar em campanhas.",
    },
  ],
  sales: [
    {
      role: "assistant",
      content: "Sou a Growdash para Vendas. Posso criar scripts, cadências, follow-ups e planos para aumentar fechamento.",
    },
  ],
  support: [
    {
      role: "assistant",
      content: "Sou a Growdash para Suporte. Me diga qual erro, integração ou fluxo da plataforma você quer diagnosticar.",
    },
  ],
};

const placeholders: Record<Specialist, string> = {
  traffic: "Ex: qual campanha devo pausar hoje?",
  sales: "Ex: crie um follow-up para leads quentes",
  support: "Ex: por que minha integração RD não sincroniza?",
};

const AI_MEMORY_KEY = "growdash:ai-memory";
const AI_MEMORY_TTL_MS = 48 * 60 * 60 * 1000;

function readAIMemory(): Record<Specialist, ChatMessage[]> {
  try {
    const raw = localStorage.getItem(AI_MEMORY_KEY);
    if (!raw) return initialMessages;
    const parsed = JSON.parse(raw) as { startedAt?: number; messages?: Record<Specialist, ChatMessage[]> };
    if (!parsed.startedAt || Date.now() - parsed.startedAt > AI_MEMORY_TTL_MS) {
      localStorage.removeItem(AI_MEMORY_KEY);
      return initialMessages;
    }
    return {
      traffic: parsed.messages?.traffic?.length ? parsed.messages.traffic : initialMessages.traffic,
      sales: parsed.messages?.sales?.length ? parsed.messages.sales : initialMessages.sales,
      support: parsed.messages?.support?.length ? parsed.messages.support : initialMessages.support,
    };
  } catch {
    return initialMessages;
  }
}

function saveAIMemory(messages: Record<Specialist, ChatMessage[]>) {
  try {
    const raw = localStorage.getItem(AI_MEMORY_KEY);
    const parsed = raw ? JSON.parse(raw) as { startedAt?: number } : {};
    const startedAt = parsed.startedAt && Date.now() - parsed.startedAt <= AI_MEMORY_TTL_MS ? parsed.startedAt : Date.now();
    localStorage.setItem(AI_MEMORY_KEY, JSON.stringify({ startedAt, messages }));
  } catch {}
}

function buildAnswer(mode: Specialist, question: string) {
  const base = specialists[mode].system;
  const clean = question.trim();

  if (!clean) return "Me diga o que você quer analisar e eu te devolvo um plano objetivo.";

  if (mode === "traffic") {
    return `${base}\n\nPlano direto para: "${clean}"\n1. Verifique campanhas com gasto alto e ROAS abaixo da meta.\n2. Separe escala de correção: só escala o que tem CAC saudável e volume consistente.\n3. Revise criativos com frequência alta, queda de CTR ou CPL subindo.\n4. Cruze origem, campanha e etapa do funil para encontrar onde o dinheiro está vazando.\n5. Próxima ação: me peça \"o que pausar hoje\" ou \"o que escalar hoje\" quando os dados estiverem sincronizados.`;
  }

  if (mode === "sales") {
    return `${base}\n\nPlano direto para: "${clean}"\n1. Identifique leads parados por etapa e tempo sem contato.\n2. Priorize oportunidades quentes por origem, intenção e histórico de interação.\n3. Revise objeções recorrentes e crie respostas padrão para o time.\n4. Meça tempo de resposta e taxa de conversão por atendente.\n5. Próxima ação: peça uma cadência de follow-up para WhatsApp ou um script de recuperação.`;
  }

  return `${base}\n\nPlano direto para: "${clean}"\n1. Verifique se a integração correspondente está ativa e com token válido.\n2. Rode o teste de conexão no módulo Integrações.\n3. Confira se há dados recentes chegando em campanhas, RD, vendas e UTMs.\n4. Se houver erro de API, copie a mensagem do diagnóstico para eu classificar a causa.\n5. Próxima ação: peça um checklist para corrigir a integração específica.`;
}

export function GrowdashAIButton() {
  const [open, setOpen] = useState(false);
  const [inputs, setInputs] = useState<Record<Specialist, string>>({ traffic: "", sales: "", support: "" });
  const [loading, setLoading] = useState<Record<Specialist, boolean>>({ traffic: false, sales: false, support: false });
  const [messages, setMessages] = useState<Record<Specialist, ChatMessage[]>>(() => readAIMemory());

  useEffect(() => {
    saveAIMemory(messages);
  }, [messages]);

  const send = async (mode: Specialist) => {
    const question = inputs[mode].trim();
    if (!question || loading[mode]) return;
    setInputs((current) => ({ ...current, [mode]: "" }));
    setMessages((current) => ({
      ...current,
      [mode]: [...current[mode], { role: "user", content: question }],
    }));
    setLoading((current) => ({ ...current, [mode]: true }));
    window.setTimeout(() => {
      setMessages((current) => ({
        ...current,
        [mode]: [...current[mode], { role: "assistant", content: buildAnswer(mode, question) }],
      }));
      setLoading((current) => ({ ...current, [mode]: false }));
    }, 450);
  };

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="mb-3 flex h-[min(760px,calc(100vh-7rem))] w-[min(1180px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-white/10 bg-card/95 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 text-cyan-200">
                <BrainCircuit className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">Growdash</h3>
                <p className="text-xs text-muted-foreground">Copilotos separados por área operacional</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="hidden gap-1 sm:flex">
                <Maximize2 className="h-3.5 w-3.5" />
                3 chats independentes
              </Badge>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-3 md:grid-cols-3 md:overflow-hidden">
            {(Object.keys(specialists) as Specialist[]).map((mode) => {
              const Icon = specialists[mode].icon;
              return (
                <section
                  key={mode}
                  className="flex min-h-[520px] flex-col overflow-hidden rounded-lg border border-white/10 bg-background/55 md:min-h-0"
                >
                  <div className="border-b border-white/10 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-semibold">{specialists[mode].label}</h4>
                        <p className="truncate text-xs text-muted-foreground">{specialists[mode].system}</p>
                      </div>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                    {messages[mode].map((message, index) => (
                      <div
                        key={`${mode}-${message.role}-${index}`}
                        className={cn(
                          "whitespace-pre-line rounded-lg border p-3 text-sm leading-6",
                          message.role === "user"
                            ? "ml-6 border-primary/30 bg-primary/10"
                            : "mr-6 border-white/10 bg-card/70",
                        )}
                      >
                        {message.content}
                      </div>
                    ))}
                    {loading[mode] && (
                      <div className="mr-6 flex items-center gap-2 rounded-lg border border-white/10 bg-card/70 p-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Growdash está pensando...
                      </div>
                    )}
                  </div>

                  <div className="border-t border-white/10 p-3">
                    <Textarea
                      value={inputs[mode]}
                      onChange={(event) => setInputs((current) => ({ ...current, [mode]: event.target.value }))}
                      placeholder={placeholders[mode]}
                      className="min-h-20 resize-none bg-background/70"
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void send(mode);
                      }}
                    />
                    <Button
                      className="mt-2 w-full gap-2"
                      onClick={() => send(mode)}
                      disabled={!inputs[mode].trim() || loading[mode]}
                    >
                      <Send className="h-4 w-4" />
                      Enviar para {specialists[mode].label}
                    </Button>
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      <Button
        size="lg"
        className="h-14 rounded-full border border-cyan-300/30 px-5 shadow-2xl shadow-cyan-950/40"
        onClick={() => setOpen((value) => !value)}
      >
        <Bot className="mr-2 h-5 w-5" />
        Growdash
      </Button>
    </div>
  );
}
