import { Plus } from "lucide-react";
import { PageHeader, StatCard } from "@/components/page-primitives";
import { Empty, Button } from "@/components/list-primitives";

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
        <StatCard label="Ativas" value="0" accent="primary" />
        <StatCard label="Enviados mês" value="0" accent="pink" />
        <StatCard label="Conversão média" value="0%" accent="green" />
      </div>
      <Empty title="Nenhuma campanha criada" hint="Crie campanhas de reengajamento, boas-vindas ou promoções sazonais." />
    </div>
  );
}
