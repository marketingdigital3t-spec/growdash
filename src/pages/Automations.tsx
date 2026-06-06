import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Database,
  MessageCircle,
  Plus,
  Save,
  Send,
  Settings2,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { WhatsAppConnectionPanel } from "@/components/whatsapp/WhatsAppConnectionPanel";
import {
  readWhatsAppConnection,
  selectedWhatsAppChat,
  WHATSAPP_EVENT_KEY,
  type WhatsAppConnectionState,
} from "@/components/whatsapp/whatsappConnection";

const reportVariables = [
  "{{data_ontem}}",
  "{{leads_carla_paciente_modelo}}",
  "{{leads_carla_instituto}}",
  "{{leads_dro_junior}}",
  "{{leads_joao_appolinario}}",
  "{{total_leads_ontem}}",
];

const defaultMessage = `*Bom dia Time, segue relatório dos leads do dia de ontem ({{data_ontem}}):*

Dra. Carla Rezende - Paciente Modelo: {{leads_carla_paciente_modelo}} leads
Dra. Carla Rezende - Curso: {{leads_carla_instituto}} leads
Dro. Junior Rodrigues: {{leads_dro_junior}} leads
João Appolinário: {{leads_joao_appolinario}} leads

Total consolidado: {{total_leads_ontem}} leads`;

const mockPreviewValues: Record<string, string> = {
  "{{data_ontem}}": "04/06/2026",
  "{{leads_carla_paciente_modelo}}": "18",
  "{{leads_carla_instituto}}": "42",
  "{{leads_dro_junior}}": "27",
  "{{leads_joao_appolinario}}": "13",
  "{{total_leads_ontem}}": "100",
};

const flowNodes = [
  {
    icon: CalendarClock,
    title: "Gatilho agendado",
    subtitle: "Todos os dias às 09:00",
    tone: "from-violet-500/25 to-violet-500/5",
  },
  {
    icon: Database,
    title: "Buscar dados RD",
    subtitle: "Leads iniciados ontem por conta",
    tone: "from-cyan-500/20 to-cyan-500/5",
  },
  {
    icon: Bot,
    title: "Montar mensagem",
    subtitle: "Substituir variáveis do relatório",
    tone: "from-fuchsia-500/20 to-fuchsia-500/5",
  },
  {
    icon: MessageCircle,
    title: "Enviar WhatsApp",
    subtitle: "Grupo ou número configurado",
    tone: "from-emerald-500/20 to-emerald-500/5",
  },
];

function renderPreview(template: string) {
  return Object.entries(mockPreviewValues).reduce(
    (text, [key, value]) => text.split(key).join(value),
    template,
  );
}

export default function Automations() {
  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] = useState("daily");
  const [time, setTime] = useState("09:00");
  const [provider, setProvider] = useState("whatsapp_qr");
  const [message, setMessage] = useState(defaultMessage);
  const [whatsappState, setWhatsappState] = useState<WhatsAppConnectionState>(() => readWhatsAppConnection());

  useEffect(() => {
    const sync = (event?: Event) => {
      const next = event instanceof CustomEvent
        ? event.detail as WhatsAppConnectionState
        : readWhatsAppConnection();
      setWhatsappState(next);
    };
    window.addEventListener("storage", sync);
    window.addEventListener(WHATSAPP_EVENT_KEY, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(WHATSAPP_EVENT_KEY, sync);
    };
  }, []);

  const preview = useMemo(() => renderPreview(message), [message]);
  const selectedChat = selectedWhatsAppChat(whatsappState);
  const payload = useMemo(
    () => ({
      provider,
      schedule: {
        frequency,
        times: time.split(",").map((item) => item.trim()).filter(Boolean),
        timezone: "America/Sao_Paulo",
      },
      action: "send_whatsapp_message",
      destination: selectedChat
        ? {
            id: selectedChat.id,
            name: selectedChat.name,
            type: selectedChat.type,
            phone: selectedChat.phone || null,
          }
        : null,
      connectedPhone: whatsappState.phone || null,
      template: message,
      preview,
      variables: {
        data_ontem: "date:yesterday:dd/MM/yyyy",
        leads_carla_paciente_modelo: "rd.deals.started:yesterday:account:paciente_modelo",
        leads_carla_instituto: "rd.deals.started:yesterday:account:instituto_carla",
        leads_dro_junior: "rd.deals.started:yesterday:account:dro_junior",
        leads_joao_appolinario: "rd.deals.started:yesterday:account:joao_appolinario",
        total_leads_ontem: "rd.deals.started:yesterday:all_accounts",
      },
    }),
    [frequency, message, preview, provider, selectedChat, time, whatsappState.phone],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <Badge variant="outline" className="mb-3 border-primary/40 bg-primary/10 text-primary">
            Automação visual
          </Badge>
          <h1 className="text-2xl font-bold">Automações</h1>
          <p className="max-w-3xl text-muted-foreground">
            Crie fluxos estilo Manychat para transformar dados da plataforma em ações automáticas no WhatsApp, agenda e alertas comerciais.
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nova automação
        </Button>
      </div>

      <Card className="overflow-hidden border-primary/20 bg-card/70">
        <CardHeader className="border-b border-border/40 bg-primary/5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Workflow className="h-5 w-5 text-primary" />
                Relatório diário de leads no WhatsApp
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Modelo pronto para puxar negociações iniciadas no RD por conta e enviar um resumo diário.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{enabled ? "Ativa" : "Rascunho"}</span>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-5">
          <div className="relative overflow-x-auto rounded-xl border border-white/10 bg-background/40 p-4">
            <div className="flex min-w-[920px] items-center gap-4">
              {flowNodes.map((node, index) => {
                const Icon = node.icon;
                return (
                  <div key={node.title} className="flex flex-1 items-center gap-4">
                    <div className={cn("min-h-32 flex-1 rounded-xl border border-primary/20 bg-gradient-to-br p-4 shadow-[0_0_32px_hsl(var(--primary)/0.08)]", node.tone)}>
                      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-background/70 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="font-semibold">{node.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{node.subtitle}</p>
                    </div>
                    {index < flowNodes.length - 1 && (
                      <div className="h-px w-10 shrink-0 bg-primary/50 shadow-[0_0_14px_hsl(var(--primary)/0.5)]" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <WhatsAppConnectionPanel compact />

          <div className="grid gap-4 xl:grid-cols-[1fr_1fr_420px]">
            <Card className="bg-background/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Settings2 className="h-4 w-4 text-primary" />
                  Configuração
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Provedor WhatsApp</Label>
                    <Select value={provider} onValueChange={setProvider}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="whatsapp_qr">WhatsApp por QR Code</SelectItem>
                        <SelectItem value="whatsapp_cloud">WhatsApp Cloud API</SelectItem>
                        <SelectItem value="zapi">Z-API</SelectItem>
                        <SelectItem value="webhook">Webhook próprio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Destino WhatsApp</Label>
                    <div className="min-h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm">
                      <p className="truncate font-medium">
                        {selectedChat ? selectedChat.name : "Nenhum grupo ou conversa selecionado"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedChat
                          ? `${selectedChat.type === "group" ? "Grupo" : "Conversa"} selecionado para envio`
                          : "Conecte o WhatsApp e escolha um destino no painel acima"}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Recorrência</Label>
                    <Select value={frequency} onValueChange={setFrequency}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Todos os dias</SelectItem>
                        <SelectItem value="weekdays">Dias úteis</SelectItem>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="custom">Personalizado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Horários</Label>
                    <Input value={time} onChange={(event) => setTime(event.target.value)} placeholder="09:00, 18:00" />
                  </div>
                </div>
                <Badge className="gap-2 bg-primary/15 text-primary hover:bg-primary/15">
                  <Clock3 className="h-3.5 w-3.5" />
                  O backend deve executar via cron/fila e registrar logs de envio.
                </Badge>
              </CardContent>
            </Card>

            <Card className="bg-background/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageCircle className="h-4 w-4 text-primary" />
                  Mensagem pré-definida
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  className="min-h-64 resize-y font-mono text-xs leading-relaxed"
                />
                <div className="flex flex-wrap gap-2">
                  {reportVariables.map((variable) => (
                    <button
                      key={variable}
                      type="button"
                      onClick={() => setMessage((current) => `${current} ${variable}`)}
                      className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] text-primary transition hover:bg-primary/20"
                    >
                      {variable}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-background/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Send className="h-4 w-4 text-primary" />
                  Prévia e payload
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm leading-relaxed whitespace-pre-wrap">
                  {preview}
                </div>
                <pre className="max-h-64 overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 text-[11px] text-violet-100">
                  {JSON.stringify(payload, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-2 border-t border-border/40 pt-4 sm:flex-row sm:justify-end">
            <Button variant="outline" className="gap-2">
              <Save className="h-4 w-4" />
              Salvar rascunho
            </Button>
            <Button className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Preparar automação
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
