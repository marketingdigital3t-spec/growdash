import { Plus, Package } from "lucide-react";
import { PageHeader } from "@/components/page-primitives";
import { Card, Button, Badge } from "@/components/list-primitives";

const pacotes = [
  { nome: "5 sessões de Laser CO2", preco: "R$ 3.500", sessoes: 5, vendidos: 32 },
  { nome: "Clareamento íntimo completo", preco: "R$ 1.800", sessoes: 3, vendidos: 21 },
  { nome: "Rejuvenescimento íntimo", preco: "R$ 4.900", sessoes: 4, vendidos: 14 },
  { nome: "Depilação a laser (6 sessões)", preco: "R$ 2.400", sessoes: 6, vendidos: 47 },
];

export default function Pacotes() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Vendas", "Pacotes"]}
        title="Pacotes"
        subtitle="Combos de sessões e tratamentos oferecidos."
        actions={<Button><Plus className="h-4 w-4" /> Novo pacote</Button>}
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {pacotes.map((p) => (
          <Card key={p.nome}>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Package className="h-6 w-6" />
            </div>
            <p className="text-base font-extrabold text-foreground">{p.nome}</p>
            <p className="mt-1 text-2xl font-extrabold text-primary">{p.preco}</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">{p.sessoes} sessões</p>
            <div className="mt-3"><Badge tone="green">{p.vendidos} vendidos</Badge></div>
          </Card>
        ))}
      </div>
    </div>
  );
}
