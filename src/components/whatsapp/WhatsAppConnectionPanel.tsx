import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, MessageCircle, QrCode, RefreshCw, Search, Smartphone, Users, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  defaultWhatsAppState,
  readWhatsAppConnection,
  saveWhatsAppConnection,
  selectedWhatsAppChat,
  WHATSAPP_EVENT_KEY,
  type WhatsAppConnectionState,
} from "./whatsappConnection";

function FakeQRCode() {
  return (
    <div className="grid h-44 w-44 grid-cols-7 grid-rows-7 gap-1 rounded-2xl border border-primary/30 bg-white p-3 shadow-[0_0_32px_hsl(var(--primary)/0.25)]">
      {Array.from({ length: 49 }).map((_, index) => {
        const active = [0, 1, 2, 7, 14, 15, 16, 4, 5, 6, 13, 20, 27, 34, 41, 42, 43, 35, 28, 21, 24, 26, 30, 32, 36, 38, 40, 44, 46, 48].includes(index);
        return <div key={index} className={cn("rounded-sm", active ? "bg-violet-950" : "bg-violet-100")} />;
      })}
    </div>
  );
}

export function WhatsAppConnectionPanel({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<WhatsAppConnectionState>(() => readWhatsAppConnection());
  const [search, setSearch] = useState("");

  useEffect(() => {
    const sync = (event?: Event) => {
      const next = event instanceof CustomEvent ? event.detail as WhatsAppConnectionState : readWhatsAppConnection();
      setState(next);
    };
    window.addEventListener("storage", sync);
    window.addEventListener(WHATSAPP_EVENT_KEY, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(WHATSAPP_EVENT_KEY, sync);
    };
  }, []);

  const selected = selectedWhatsAppChat(state);
  const filteredChats = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return state.chats;
    return state.chats.filter((chat) => `${chat.name} ${chat.phone || ""}`.toLowerCase().includes(q));
  }, [search, state.chats]);

  const update = (patch: Partial<WhatsAppConnectionState>) => {
    const next = { ...state, ...patch };
    setState(next);
    saveWhatsAppConnection(next);
  };

  const startQr = () => update({ status: "qr_pending" });
  const finishQr = () => {
    update({
      status: "connected",
      phone: state.phone || "5511961551975",
      connectedAt: new Date().toISOString(),
      selectedChatId: state.selectedChatId || state.chats[0]?.id || "",
    });
  };
  const disconnect = () => {
    setState(defaultWhatsAppState);
    saveWhatsAppConnection(defaultWhatsAppState);
  };

  return (
    <Card className={cn("border-primary/20 bg-card/80", compact && "bg-background/50")}>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              WhatsApp conectado por QR Code
            </CardTitle>
            <CardDescription>
              Vincule o numero, sincronize grupos/conversas e escolha onde as automacoes vao enviar mensagens.
            </CardDescription>
          </div>
          <Badge className={cn(
            "w-fit gap-1.5",
            state.status === "connected" ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/15" : "bg-amber-500/15 text-amber-300 hover:bg-amber-500/15",
          )}>
            {state.status === "connected" ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {state.status === "connected" ? "Conectado" : state.status === "qr_pending" ? "Aguardando leitura" : "Desconectado"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <QrCode className="h-4 w-4 text-primary" />
              Conexao
            </div>
            {state.status === "qr_pending" ? (
              <div className="space-y-4">
                <FakeQRCode />
                <p className="text-xs text-muted-foreground">
                  Abra o WhatsApp no celular, toque em aparelhos conectados e leia o QR Code.
                </p>
                <Button className="w-full gap-2" onClick={finishQr}>
                  <CheckCircle2 className="h-4 w-4" />
                  Simular QR lido
                </Button>
              </div>
            ) : state.status === "connected" ? (
              <div className="space-y-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
                  <Smartphone className="h-7 w-7" />
                </div>
                <div>
                  <p className="font-semibold">{state.phone}</p>
                  <p className="text-xs text-muted-foreground">
                    {state.connectedAt ? `Conectado em ${new Date(state.connectedAt).toLocaleString("pt-BR")}` : "Sessao ativa"}
                  </p>
                </div>
                <Button variant="outline" className="w-full" onClick={disconnect}>
                  Desconectar
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Label>Numero do WhatsApp</Label>
                <Input value={state.phone} onChange={(event) => update({ phone: event.target.value })} placeholder="5511999999999" />
                <Button className="w-full gap-2" onClick={startQr}>
                  <QrCode className="h-4 w-4" />
                  Gerar QR Code
                </Button>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-background/40 p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">Grupos e conversas</p>
                <p className="text-xs text-muted-foreground">
                  Destino selecionado: {selected ? selected.name : "nenhum"}
                </p>
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Sincronizar conversas
              </Button>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar grupo ou conversa..." />
            </div>
            <div className="grid max-h-72 gap-2 overflow-auto pr-1">
              {filteredChats.map((chat) => {
                const active = chat.id === state.selectedChatId;
                return (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => update({ selectedChatId: chat.id })}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition",
                      active ? "border-primary/60 bg-primary/15 shadow-[0_0_22px_hsl(var(--primary)/0.18)]" : "border-white/10 bg-card/40 hover:border-primary/30",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        {chat.type === "group" ? <Users className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{chat.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {chat.type === "group" ? `${chat.participants || 0} participantes` : chat.phone}
                        </p>
                      </div>
                    </div>
                    {active && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
          QR Code real e leitura de grupos precisam rodar no backend por um provedor compativel com sessao WhatsApp Web, como Evolution API, Z-API ou servico proprio. A API oficial Cloud API nao lista grupos por QR Code.
        </div>
      </CardContent>
    </Card>
  );
}
