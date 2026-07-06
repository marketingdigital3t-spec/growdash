import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-primitives";
import { Empty, Button } from "@/components/list-primitives";

export default function Pacotes() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Vendas", "Pacotes"]}
        title="Pacotes"
        subtitle="Combos de sessões e tratamentos oferecidos."
        actions={<Button><Plus className="h-4 w-4" /> Novo pacote</Button>}
      />
      <Empty
        title="Nenhum pacote criado"
        hint="Monte combos de sessões (ex.: 5 sessões de laser) para vender com mais facilidade."
      />
    </div>
  );
}
