import { MessageCircle, Plus, Send } from "lucide-react";
import { PageHeader, StatCard } from "@/components/page-primitives";
import { Card, Button, Badge } from "@/components/list-primitives";

const conversas = [
  { nome: "Ana Beatriz Souza", ultima: "Obrigada, doutora! ❤️", hora: "10:24", nao: 0 },
  { nome: "Camila Oliveira", ultima: "Posso remarcar para quinta?", hora: "09:58", nao: 2 },
  { nome: "Juliana Ramos", ultima: "Já tomei o remédio", hora: "Ontem", nao: 0 },
  { nome: "Marina Prado", ultima: "Quero saber sobre o pacote", hora: "Ontem", nao: 1 },
];

export default function WhatsApp() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Comunicação", "WhatsApp"]}
        title="WhatsApp"
        subtitle="Integração oficial para atendimento por mensagens."
        actions={<Button><Plus className="h-4 w-4" /> Novo contato</Button>}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Conversas ativas" value="42" accent="green" />
        <StatCard label="Sem resposta" value="6" accent="yellow" />
        <StatCard label="Enviadas hoje" value="128" accent="primary" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Conversas">
          <ul className="divide-y divide-border">
            {conversas.map((c) => (
              <li key={c.nome} className="flex items-center gap-3 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-bold text-foreground">{c.nome}</p>
                    <span className="text-xs font-semibold text-muted-foreground">{c.hora}</span>
                  </div>
                  <p className="truncate text-xs font-semibold text-muted-foreground">{c.ultima}</p>
                </div>
                {c.nao > 0 && <Badge tone="pink">{c.nao}</Badge>}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Ana Beatriz Souza" subtitle="Última mensagem há 4 min">
          <div className="mb-4 space-y-2">
            <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-muted p-3 text-sm">Olá! Confirmando seu horário amanhã às 14h ✨</div>
            <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-primary p-3 text-sm text-primary-foreground">Confirmadinho! Obrigada 💕</div>
            <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-muted p-3 text-sm">Perfeito, te espero!</div>
          </div>
          <div className="flex gap-2">
            <input className="h-10 flex-1 rounded-xl border border-border bg-card px-3 text-sm" placeholder="Digite uma mensagem..." />
            <Button><Send className="h-4 w-4" /></Button>
          </div>
        </Card>

        <Card title="Modelos rápidos">
          <ul className="space-y-2 text-sm">
            {["Confirmação de horário", "Lembrete 24h antes", "Pós-atendimento", "Aniversário", "Reagendamento"].map((m) => (
              <li key={m} className="rounded-xl border border-border bg-muted/40 px-3 py-2 font-semibold">{m}</li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
