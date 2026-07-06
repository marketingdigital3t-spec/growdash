export default function Home() {
  return (
    <div className="p-6 md:p-8">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <span className="text-primary">Clínica</span>
        <span className="text-muted-foreground">/</span>
        <span className="text-primary">Início</span>
      </div>

      <div className="flex min-h-[60vh] items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 text-center">
        <div>
          <p className="text-lg font-bold text-foreground">Interface inicial</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Sidebar de ícones + topbar prontos. Vamos adicionar os blocos da home nos próximos passos.
          </p>
        </div>
      </div>
    </div>
  );
}
