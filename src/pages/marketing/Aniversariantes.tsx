import { Cake, Send } from "lucide-react";
import { PageHeader } from "@/components/page-primitives";
import { Card, Button, Badge } from "@/components/list-primitives";

const list = [
  { nome: "Ana Beatriz Souza", dia: "08/07", canal: "WhatsApp", cupom: "ANIVANA20" },
  { nome: "Camila Oliveira", dia: "11/07", canal: "E-mail", cupom: "ANIVCAM20" },
  { nome: "Juliana Ramos", dia: "14/07", canal: "WhatsApp", cupom: "ANIVJUL20" },
];

export default function MarketingAniversariantes() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Marketing", "Aniversariantes"]}
        title="Campanha de aniversário"
        subtitle="Envio automático com cupom personalizado."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {list.map((l) => (
          <Card key={l.nome}>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Cake className="h-6 w-6" />
            </div>
            <p className="text-base font-extrabold text-foreground">{l.nome}</p>
            <p className="text-xs font-semibold text-muted-foreground">Aniversário em {l.dia}</p>
            <div className="mt-3 flex items-center gap-2">
              <Badge tone="primary">{l.canal}</Badge>
              <Badge tone="pink">Cupom {l.cupom}</Badge>
            </div>
            <Button className="mt-4 w-full" variant="secondary"><Send className="h-4 w-4" /> Enviar agora</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
