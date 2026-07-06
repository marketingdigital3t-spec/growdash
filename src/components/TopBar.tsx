import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  MessageCircle,
  Bell,
  HelpCircle,
  Sparkles,
  Plus,
  IdCard,
  SlidersHorizontal,
  Lock,
  Award,
  LogOut,
} from "lucide-react";
import { useSidebar } from "./sidebar-context";
import { cn } from "@/lib/utils";
import SearchPalette from "./SearchPalette";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const FALLBACK_IMG = "https://i.pravatar.cc/80?img=32";

export default function TopBar() {
  const { expanded, toggle } = useSidebar();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const profileName =
    (user?.user_metadata?.full_name as string) || user?.email || "Minha conta";
  const profileImg = (user?.user_metadata?.avatar_url as string) || FALLBACK_IMG;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!menuOpen && !notifOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuOpen && !menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
      if (notifOpen && !notifRef.current?.contains(e.target as Node)) setNotifOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, notifOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  const go = (path: string) => {
    setMenuOpen(false);
    navigate(path);
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-card px-3 md:px-4">
      <button
        type="button"
        aria-label={expanded ? "Fechar menu" : "Abrir menu"}
        onClick={toggle}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-muted"
      >
        {expanded ? (
          <X className="h-5 w-5" strokeWidth={2} />
        ) : (
          <Menu className="h-5 w-5" strokeWidth={1.8} />
        )}
      </button>

      <Link to="/" className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[hsl(340_85%_60%)] text-[13px] font-black tracking-tight text-primary-foreground shadow-[0_8px_22px_-8px_hsl(var(--primary)/0.55)]">
          CN
        </span>
        <span className="text-[22px] font-extrabold tracking-tight text-foreground">
          clinic<span className="font-black text-primary">next</span>
        </span>
      </Link>

      <div className="flex-1" />

      <Link
        to="/comunicacao/whatsapp"
        aria-label="WhatsApp"
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(340_90%_96%)] text-[hsl(340_85%_55%)] transition-colors hover:bg-[hsl(340_90%_92%)]"
      >
        <MessageCircle className="h-5 w-5" strokeWidth={2} />
      </Link>

      <div className="group/tt relative">
        <button
          type="button"
          aria-label="Buscar"
          onClick={() => setSearchOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(280_85%_70%)] via-[hsl(260_90%_72%)] to-[hsl(220_95%_72%)] text-white shadow-sm transition-transform hover:scale-105"
        >
          <div className="relative">
            <Sparkles className="h-5 w-5" strokeWidth={2} />
            <Plus className="absolute -bottom-1 -right-1 h-3 w-3" strokeWidth={3} />
          </div>
        </button>
        <span className="pointer-events-none absolute left-1/2 top-full z-40 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2.5 py-1 text-xs font-semibold text-background opacity-0 shadow-md transition-opacity group-hover/tt:opacity-100">
          Buscar <kbd className="ml-1 rounded bg-white/20 px-1 text-[10px]">⌘K</kbd>
        </span>
      </div>

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />

      <a
        href="https://docs.lovable.dev"
        target="_blank"
        rel="noreferrer"
        className="flex h-10 items-center gap-2 rounded-xl px-2 text-[hsl(var(--sidebar-icon))] transition-colors hover:bg-muted"
      >
        <HelpCircle className="h-5 w-5" strokeWidth={1.8} />
        <span className="text-sm font-semibold">Ajuda</span>
      </a>

      <div className="relative" ref={notifRef}>
        <button
          type="button"
          aria-label="Notificações"
          onClick={() => setNotifOpen((v) => !v)}
          className="relative flex h-10 w-10 items-center justify-center rounded-xl text-[hsl(var(--sidebar-icon))] transition-colors hover:bg-muted"
        >
          <Bell className="h-5 w-5" strokeWidth={1.8} />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-pink" />
        </button>
        <div
          className={cn(
            "absolute right-0 top-full z-50 mt-2 w-[320px] origin-top-right rounded-2xl border border-border bg-card p-4 shadow-[0_20px_60px_-20px_rgb(0_0_0/0.25)] transition-all",
            notifOpen
              ? "pointer-events-auto scale-100 opacity-100"
              : "pointer-events-none scale-95 opacity-0",
          )}
        >
          <p className="mb-1 text-sm font-bold text-foreground">Notificações</p>
          <p className="text-xs text-muted-foreground">Você está em dia — nenhuma novidade por aqui.</p>
        </div>
      </div>

      <div className="relative ml-1" ref={menuRef}>
        <button
          type="button"
          aria-label="Perfil"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="block rounded-full"
        >
          <img
            src={profileImg}
            alt={profileName}
            className="h-10 w-10 rounded-full border-2 border-white object-cover ring-2 ring-border transition-shadow hover:ring-primary"
          />
        </button>

        <div
          role="menu"
          className={cn(
            "absolute right-0 top-full z-50 mt-2 w-[320px] origin-top-right rounded-2xl border border-border bg-card p-2 shadow-[0_20px_60px_-20px_rgb(0_0_0/0.25)] transition-all",
            menuOpen
              ? "pointer-events-auto scale-100 opacity-100"
              : "pointer-events-none scale-95 opacity-0",
          )}
        >
          <div className="flex items-center gap-3 px-3 py-3">
            <img src={profileImg} alt={profileName} className="h-11 w-11 rounded-full object-cover" />
            <span className="text-[17px] font-extrabold text-foreground line-clamp-2">
              {profileName}
            </span>
          </div>
          <div className="my-1 h-px bg-border" />
          <MenuItem icon={IdCard} label="Perfil" onClick={() => go("/config/perfil")} />
          <MenuItem
            icon={SlidersHorizontal}
            label="Preferências"
            onClick={() => go("/config/clinica")}
          />
          <MenuItem icon={Lock} label="Segurança" onClick={() => go("/chat-seguro")} />
          <MenuItem icon={Award} label="Indique e ganhe" onClick={() => go("/comunidade")} />
          <MenuItem icon={LogOut} label="Sair" onClick={handleLogout} />
        </div>
      </div>
    </header>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof IdCard;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] font-semibold text-foreground/85 transition-colors hover:bg-primary-soft hover:text-primary"
    >
      <Icon className="h-5 w-5 text-[hsl(var(--sidebar-icon))]" strokeWidth={1.8} />
      {label}
    </button>
  );
}
