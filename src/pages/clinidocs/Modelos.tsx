import { FileText, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-primitives";
import { Card, Button, Badge } from "@/components/list-primitives";

const modelos = [
  { nome: "Termo de consentimento — Laser CO2", cat: "Consentimento", updated: "02/07/2026" },
  { nome: "Anamnese ginecológica estética", cat: "Anamnese", updated: "01/07/2026" },
  { nome: "Termo LGPD — Uso de imagem", cat: "LGPD", updated: "20/06/2026" },
  { nome: "Receita simples", cat: "Prescrição", updated: "12/06/2026" },
];

export default function Modelos() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "CliniDocs", "Modelos"]}
        title="Modelos de documentos"
        subtitle="Reutilize modelos com variáveis dinâmicas por paciente."
        actions={<Button><Plus className="h-4 w-4" /> Novo modelo</Button>}
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {modelos.map((m) => (
          <Card key={m.nome}>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <FileText className="h-6 w-6" />
            </div>
            <p className="text-sm font-extrabold text-foreground">{m.nome}</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">Atualizado em {m.updated}</p>
            <div className="mt-3"><Badge tone="primary">{m.cat}</Badge></div>
          </Card>
        ))}
      </div>
    </div>
  );
}
