import { PageHeader } from "@/components/page-primitives";
import { Empty } from "@/components/list-primitives";

export default function MarketingAniversariantes() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Marketing", "Aniversariantes"]}
        title="Campanha de aniversário"
        subtitle="Envio automático com cupom personalizado."
      />
      <Empty
        title="Nenhuma aniversariante no período"
        hint="Configure o modelo de mensagem e o cupom padrão para envio automático quando houver aniversariantes."
      />
    </div>
  );
}
