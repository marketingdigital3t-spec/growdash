import { PageHeader } from "@/components/page-primitives";
import { Card, Button, Input, Badge } from "@/components/list-primitives";
import { Building2, MapPin } from "lucide-react";

export default function Clinica() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Configurações", "Clínica"]}
        title="Dados da clínica"
        subtitle="Informações usadas em documentos, recibos e comunicação."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Identificação">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-base font-extrabold text-foreground">Clínica Íntima</p>
              <Badge tone="green">Plano Pro</Badge>
            </div>
          </div>
          <div className="space-y-3">
            <Input placeholder="Nome fantasia" defaultValue="Clínica Íntima" className="w-full" />
            <Input placeholder="Razão social" className="w-full" />
            <Input placeholder="CNPJ" className="w-full" />
            <Input placeholder="Responsável técnico" className="w-full" />
            <Button>Salvar</Button>
          </div>
        </Card>

        <Card title="Endereço e contato">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <MapPin className="h-4 w-4" /> Endereço principal
          </div>
          <div className="space-y-3">
            <Input placeholder="CEP" className="w-full" />
            <Input placeholder="Rua e número" className="w-full" />
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Cidade" />
              <Input placeholder="UF" />
            </div>
            <Input placeholder="Telefone da clínica" className="w-full" />
            <Input placeholder="E-mail comercial" className="w-full" />
            <Button variant="secondary">Adicionar unidade</Button>
          </div>
        </Card>

        <Card title="Horário de atendimento">
          <div className="space-y-2 text-sm font-semibold">
            {[
              ["Segunda a sexta", "08:00 – 19:00"],
              ["Sábado", "09:00 – 14:00"],
              ["Domingo", "Fechado"],
            ].map(([d, h]) => (
              <div key={d} className="flex items-center justify-between rounded-xl border border-border p-3">
                <span>{d}</span><span className="text-muted-foreground">{h}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="LGPD e Termos">
          <ul className="space-y-2 text-sm font-semibold">
            <li className="flex items-center justify-between rounded-xl border border-border p-3">
              <span>Política de Privacidade publicada</span><Badge tone="green">Ok</Badge>
            </li>
            <li className="flex items-center justify-between rounded-xl border border-border p-3">
              <span>Termo LGPD no primeiro acesso</span><Badge tone="green">Ok</Badge>
            </li>
            <li className="flex items-center justify-between rounded-xl border border-border p-3">
              <span>DPO / Encarregado cadastrado</span><Badge tone="yellow">Pendente</Badge>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
