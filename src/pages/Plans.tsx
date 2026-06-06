import { Check, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const plans = [
  {
    name: "Grátis",
    price: "R$ 0",
    description: "Para testar a operação e validar o cockpit.",
    features: ["Dashboard básico", "1 usuário", "Dados manuais", "Sem integrações premium"],
    highlighted: false,
  },
  {
    name: "Início",
    price: "R$ 197",
    description: "Para pequenas operações começarem com dados reais.",
    features: ["Meta Ads leitura", "RD Station básico", "Até 3 usuários", "Alertas essenciais"],
    highlighted: false,
  },
  {
    name: "Crescimento",
    price: "R$ 497",
    description: "Para times que precisam escalar funil e comercial.",
    features: ["CRM integrado", "Ranking comercial", "Automações", "Dashboards editáveis"],
    highlighted: true,
  },
  {
    name: "Pro",
    price: "R$ 997",
    description: "Para agências e empresas com múltiplas contas.",
    features: ["Multiempresa", "Permissões avançadas", "IA por área", "Suporte prioritário"],
    highlighted: false,
  },
];

export default function Plans() {
  return (
    <div className="space-y-8">
      <div className="mx-auto max-w-3xl text-center">
        <Badge className="mb-4 gap-2 bg-primary/15 text-primary hover:bg-primary/15">
          <Sparkles className="h-3.5 w-3.5" />
          Planos Growdash
        </Badge>
        <h1 className="text-3xl font-bold md:text-4xl">Escolha o plano da sua operação</h1>
        <p className="mt-3 text-muted-foreground">
          Esta página está pronta para conectar ao Stripe Checkout. O bloqueio por assinatura deve ser ativado somente com webhook e status de pagamento validados no backend.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {plans.map((plan) => (
          <section
            key={plan.name}
            className={
              plan.highlighted
                ? "relative overflow-hidden rounded-lg border border-primary/45 bg-primary/15 p-5 shadow-[0_0_60px_hsl(var(--primary)/0.18)]"
                : "rounded-lg border border-white/10 bg-card/70 p-5"
            }
          >
            {plan.highlighted && (
              <div className="absolute right-4 top-4 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                Recomendado
              </div>
            )}
            <h2 className="text-xl font-bold">{plan.name}</h2>
            <p className="mt-2 min-h-12 text-sm text-muted-foreground">{plan.description}</p>
            <div className="mt-6">
              <span className="text-3xl font-bold">{plan.price}</span>
              <span className="text-sm text-muted-foreground"> / mês</span>
            </div>
            <Button className="mt-6 w-full" variant={plan.highlighted ? "default" : "outline"}>
              Conectar Stripe
            </Button>
            <ul className="mt-6 space-y-3 text-sm">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="rounded-lg border border-white/10 bg-card/70 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold">Fluxo de assinatura preparado</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Quando o Stripe estiver conectado, o webhook deve criar o usuário, gerar senha temporária, enviar email de acesso e marcar primeiro acesso para troca obrigatória de senha. Se o plano ficar inativo, o backend bloqueia o acesso e exibe uma mensagem de assinatura pendente.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
