import { Plus, Heart } from "lucide-react";
import { PageHeader, StatCard } from "@/components/page-primitives";
import { Card, Button, Badge } from "@/components/list-primitives";

const camps = [
  { nome: "Inverno íntimo — laser 20% off", canal: "WhatsApp + E-mail", enviados: 240, conv: "8%", status: "Ativa" },
  { nome: "Reengajar pacientes 90d", canal: "SMS", enviados: 86, conv: "12%", status: "Ativa" },
  { nome: "Lançamento clareamento premium", canal: "E-mail", enviados: 512, conv: "5%", status: "Encerrada" },
];
const tone: Record<string, "green" | "neutral"> = { Ativa: "green", Encerrada: "neutral" };

export default function Campanhas() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Marketing", "Campanhas"]}
        title="Campanhas"
        subtitle="Ações de comunicação e resultados."
        actions={<Button><Plus className="h-4 w-4" /> Nova campanha</Button>}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Ativas" value="4" accent="primary" />
        <StatCard label="Enviados mês" value="1.284" accent="pink" />
        <StatCard label="Conversão média" value="8,4%" accent="green" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {camps.map((c) => (
          <Card key={c.nome}>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Heart className="h-6 w-6" />
            </div>
            <p className="text-base font-extrabold text-foreground">{c.nome}</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">{c.canal} • {c.enviados} envios</p>
            <div className="mt-3 flex items-center gap-2">
              <Badge tone={tone[c.status]}>{c.status}</Badge>
              <Badge tone="pink">Conv. {c.conv}</Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
