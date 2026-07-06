import { PageHeader } from "@/components/page-primitives";
import { Empty } from "@/components/list-primitives";

export default function Mesclar() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Contatos", "Mesclar contatos"]}
        title="Mesclar contatos"
        subtitle="Combine cadastros duplicados sem perder histórico."
      />
      <Empty
        title="Nenhum cadastro duplicado detectado"
        hint="O sistema busca automaticamente por telefones e e-mails repetidos e sugere combinações aqui."
      />
    </div>
  );
}
