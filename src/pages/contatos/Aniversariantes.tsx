import { PageHeader } from "@/components/page-primitives";
import { Empty } from "@/components/list-primitives";

export default function Aniversariantes() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Contatos", "Aniversariantes"]}
        title="Aniversariantes"
        subtitle="Envie uma mensagem carinhosa e fortaleça o vínculo com suas pacientes."
      />
      <Empty
        title="Nenhuma aniversariante nesta semana"
        hint="Assim que você cadastrar pacientes com data de nascimento, elas aparecerão aqui automaticamente."
      />
    </div>
  );
}
