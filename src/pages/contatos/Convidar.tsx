import { Mail, Send } from "lucide-react";
import { PageHeader } from "@/components/page-primitives";
import { Card, Button, Input, Badge } from "@/components/list-primitives";

export default function Convidar() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Contatos", "Convidar colaboradores"]}
        title="Convidar colaboradores"
        subtitle="Envie um convite por e-mail para novos membros da equipe."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Novo convite" subtitle="A pessoa receberá um link seguro por e-mail.">
          <div className="space-y-3">
            <Input placeholder="Nome completo" className="w-full" />
            <Input placeholder="E-mail" className="w-full" type="email" />
            <select className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm font-semibold">
              <option>Profissional</option>
              <option>Recepção</option>
              <option>Administrador</option>
            </select>
            <Button className="w-full"><Send className="h-4 w-4" /> Enviar convite</Button>
          </div>
        </Card>

        <Card title="Convites pendentes">
          <ul className="divide-y divide-border">
            {[
              { nome: "Larissa Prado", email: "larissa@clinica.com", role: "Recepção" },
              { nome: "Beatriz Souza", email: "bia@clinica.com", role: "Profissional" },
            ].map((c) => (
              <li key={c.email} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-bold text-foreground">{c.nome}</p>
                  <p className="text-xs font-semibold text-muted-foreground"><Mail className="mr-1 inline h-3 w-3" />{c.email}</p>
                </div>
                <Badge tone="yellow">{c.role}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Como funciona">
          <ol className="list-decimal space-y-2 pl-5 text-sm font-semibold text-muted-foreground">
            <li>Você envia o convite.</li>
            <li>A pessoa cria a senha e ativa 2FA.</li>
            <li>Você aprova as permissões finais.</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}
