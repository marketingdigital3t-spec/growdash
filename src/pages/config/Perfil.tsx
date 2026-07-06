import { PageHeader } from "@/components/page-primitives";
import { Card, Button, Input, Badge } from "@/components/list-primitives";
import { useAuth } from "@/hooks/useAuth";
import { ShieldCheck } from "lucide-react";

export default function Perfil() {
  const { user } = useAuth();
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Configurações", "Perfil"]}
        title="Meu perfil"
        subtitle="Dados pessoais, foto e preferências."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Dados pessoais" subtitle="Essas informações aparecem para as pacientes.">
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-extrabold text-primary-foreground">
              {(user?.email?.[0] ?? "U").toUpperCase()}
            </div>
            <Button variant="secondary">Alterar foto</Button>
          </div>
          <div className="space-y-3">
            <Input placeholder="Nome completo" defaultValue="" className="w-full" />
            <Input placeholder="E-mail" defaultValue={user?.email ?? ""} className="w-full" readOnly />
            <Input placeholder="Telefone" className="w-full" />
            <Button>Salvar alterações</Button>
          </div>
        </Card>

        <Card title="Segurança" subtitle="Autenticação e recuperação.">
          <div className="space-y-3 text-sm font-semibold">
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div><p>2FA (TOTP)</p><p className="text-xs text-muted-foreground">Obrigatório para profissionais e admin.</p></div>
              <Badge tone="green"><ShieldCheck className="mr-1 inline h-3 w-3" />Ativo</Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div><p>Cofre de chaves E2E</p><p className="text-xs text-muted-foreground">Chaves privadas cifradas com sua senha.</p></div>
              <Badge tone="green">Ativo</Badge>
            </div>
            <Button variant="secondary" className="w-full">Alterar senha</Button>
          </div>
        </Card>

        <Card title="Preferências">
          <div className="space-y-3 text-sm font-semibold">
            {["Notificações por e-mail", "Notificações push", "Newsletter semanal"].map((p) => (
              <label key={p} className="flex items-center justify-between rounded-xl border border-border p-3">
                <span>{p}</span>
                <input type="checkbox" defaultChecked className="h-4 w-4 accent-[hsl(var(--primary))]" />
              </label>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
