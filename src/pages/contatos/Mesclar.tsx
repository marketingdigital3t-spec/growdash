import { GitMerge } from "lucide-react";
import { PageHeader } from "@/components/page-primitives";
import { Card, Button, Badge } from "@/components/list-primitives";

const dupes = [
  { a: "Ana B. Souza", b: "Ana Beatriz Souza", motivo: "Telefones iguais" },
  { a: "Camila O.", b: "Camila Oliveira", motivo: "E-mail idêntico" },
];

export default function Mesclar() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Contatos", "Mesclar contatos"]}
        title="Mesclar contatos"
        subtitle="Combine cadastros duplicados sem perder histórico."
      />
      <div className="space-y-3">
        {dupes.map((d, i) => (
          <Card key={i}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-base font-extrabold text-foreground">{d.a}</p>
                  <Badge tone="neutral">↔</Badge>
                  <p className="text-base font-extrabold text-foreground">{d.b}</p>
                </div>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Motivo sugerido: {d.motivo}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary">Ignorar</Button>
                <Button><GitMerge className="h-4 w-4" /> Mesclar</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
