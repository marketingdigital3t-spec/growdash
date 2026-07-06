import { NAV } from "@/nav/nav-config";
import { useLocation } from "react-router-dom";

export default function Placeholder() {
  const { pathname } = useLocation();

  const parent = NAV.find(
    (n) => pathname === n.path || pathname.startsWith(n.path + "/") || n.submenu?.some((s) => s.path === pathname),
  );
  const sub = parent?.submenu?.find((s) => s.path === pathname);
  const title = sub?.label ?? parent?.label ?? "Página";
  const section = parent?.label ?? "Clínica";

  return (
    <div className="p-6 md:p-8">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <span className="text-muted-foreground">Clínica</span>
        <span className="text-muted-foreground">/</span>
        <span className="text-primary">{section}</span>
        {sub && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="text-primary">{sub.label}</span>
          </>
        )}
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estrutura da tela pronta. Conteúdo detalhado será adicionado nos próximos passos.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-dashed border-border bg-card/50 p-6"
          >
            <div className="mb-3 h-3 w-24 rounded bg-muted" />
            <div className="mb-2 h-6 w-32 rounded bg-muted" />
            <div className="h-3 w-full rounded bg-muted/60" />
          </div>
        ))}
      </div>

      <div className="mt-4 flex min-h-[40vh] items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 text-center">
        <div>
          <p className="text-base font-bold text-foreground">Área reservada para “{title}”</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Me diga como você quer essa tela e eu monto o conteúdo.
          </p>
        </div>
      </div>
    </div>
  );
}
