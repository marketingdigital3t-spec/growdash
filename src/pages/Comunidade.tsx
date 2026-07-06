import { Flower2 } from "lucide-react";
import { PageHeader } from "@/components/page-primitives";
import { Card, Empty, Button } from "@/components/list-primitives";

export default function Comunidade() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Comunidade"]}
        title="Comunidade"
        subtitle="Espaço seguro para profissionais trocarem experiências e evoluírem juntas."
        actions={<Button><Flower2 className="h-4 w-4" /> Novo post</Button>}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Empty title="Sem publicações ainda" hint="Seja a primeira a compartilhar uma experiência com a comunidade." />
        </div>
        <div className="space-y-4">
          <Card title="Regras da comunidade">
            <ul className="list-disc space-y-2 pl-5 text-sm font-semibold text-muted-foreground">
              <li>Nunca compartilhe fotos ou dados de pacientes.</li>
              <li>Respeito acima de tudo entre colegas.</li>
              <li>Cite fontes ao trazer estudos.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
