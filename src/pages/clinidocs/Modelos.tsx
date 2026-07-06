import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-primitives";
import { Empty, Button } from "@/components/list-primitives";

export default function Modelos() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "CliniDocs", "Modelos"]}
        title="Modelos de documentos"
        subtitle="Reutilize modelos com variáveis dinâmicas por paciente."
        actions={<Button><Plus className="h-4 w-4" /> Novo modelo</Button>}
      />
      <Empty title="Nenhum modelo criado" hint="Crie termos, prescrições e anamneses reutilizáveis com campos dinâmicos." />
    </div>
  );
}
