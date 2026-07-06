import { Menu, MessageCircle, Bell, HelpCircle, Sparkles, Plus } from "lucide-react";

export default function TopBar() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-card px-4 md:px-6">
      <button
        type="button"
        aria-label="Menu"
        className="flex h-10 w-10 items-center justify-center rounded-lg text-[hsl(var(--sidebar-icon))] transition-colors hover:bg-muted"
      >
        <Menu className="h-5 w-5" strokeWidth={1.8} />
      </button>

      <a href="/" className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full border-[2.5px] border-primary">
          <span className="h-2 w-2 rounded-full bg-primary" />
        </span>
        <span className="text-[22px] font-extrabold tracking-tight text-foreground">
          clínica<span className="font-black">experts</span>
        </span>
      </a>

      <div className="flex-1" />

      <div className="hidden items-center gap-3 md:flex">
        <img
          src="https://i.pravatar.cc/40?img=47"
          alt="Assistente"
          className="h-9 w-9 rounded-full border border-border object-cover"
        />
      </div>

      <button
        type="button"
        aria-label="WhatsApp"
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(340_90%_96%)] text-[hsl(340_85%_55%)] transition-colors hover:bg-[hsl(340_90%_92%)]"
      >
        <MessageCircle className="h-5 w-5" strokeWidth={2} />
      </button>

      <button
        type="button"
        aria-label="Novo"
        className="flex h-10 w-10 items-center justify-center rounded-xl text-[hsl(var(--sidebar-icon))] transition-colors hover:bg-muted"
      >
        <div className="relative">
          <Sparkles className="h-5 w-5" strokeWidth={1.8} />
          <Plus className="absolute -bottom-1 -right-1 h-3 w-3" strokeWidth={2.5} />
        </div>
      </button>

      <button
        type="button"
        className="flex h-10 items-center gap-2 rounded-xl px-2 text-[hsl(var(--sidebar-icon))] transition-colors hover:bg-muted"
      >
        <HelpCircle className="h-5 w-5" strokeWidth={1.8} />
        <span className="text-sm font-semibold">Ajuda</span>
      </button>

      <button
        type="button"
        aria-label="Notificações"
        className="relative flex h-10 w-10 items-center justify-center rounded-xl text-[hsl(var(--sidebar-icon))] transition-colors hover:bg-muted"
      >
        <Bell className="h-5 w-5" strokeWidth={1.8} />
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-pink" />
      </button>

      <button type="button" aria-label="Perfil" className="ml-1">
        <img
          src="https://i.pravatar.cc/40?img=32"
          alt="Perfil"
          className="h-10 w-10 rounded-full border-2 border-white object-cover ring-2 ring-border"
        />
      </button>
    </header>
  );
}
