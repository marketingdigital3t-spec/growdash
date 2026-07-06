import { Plus } from "lucide-react";
import { PageHeader, StatCard } from "@/components/page-primitives";
import { Card, Button } from "@/components/list-primitives";

export default function WhatsApp() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Comunicação", "WhatsApp"]}
        title="WhatsApp"
        subtitle="Integração oficial para atendimento por mensagens."
        actions={<Button><Plus className="h-4 w-4" /> Novo contato</Button>}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Conversas ativas" value="0" accent="green" />
        <StatCard label="Sem resposta" value="0" accent="yellow" />
        <StatCard label="Enviadas hoje" value="0" accent="primary" />
      </div>
      <Card>
        <p className="py-10 text-center text-sm font-semibold text-muted-foreground">
          Nenhuma conversa iniciada. Conecte seu número oficial do WhatsApp para começar a atender por aqui.
        </p>
      </Card>
    </div>
  );
}
