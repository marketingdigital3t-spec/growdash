import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, CornerDownLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { NAV } from "@/nav/nav-config";
import { cn } from "@/lib/utils";

type Result = {
  key: string;
  label: string;
  section: string;
  path: string;
  icon: (typeof NAV)[number]["icon"];
};

const ALL_RESULTS: Result[] = NAV.flatMap((n) => {
  const base: Result[] = [];
  if (n.submenu?.length) {
    n.submenu.forEach((s) =>
      base.push({ key: `${n.id}:${s.path}`, label: s.label, section: n.label, path: s.path, icon: n.icon }),
    );
  } else {
    base.push({ key: n.id, label: n.label, section: n.label, path: n.path, icon: n.icon });
  }
  return base;
});

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const results = useMemo(() => {
    if (!q.trim()) return ALL_RESULTS.slice(0, 8);
    const n = normalize(q);
    return ALL_RESULTS.filter((r) => normalize(r.label).includes(n) || normalize(r.section).includes(n)).slice(0, 20);
  }, [q]);

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => setIdx(0), [q]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIdx((i) => Math.min(i + 1, results.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setIdx((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const r = results[idx];
        if (r) {
          navigate(r.path);
          onClose();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, results, idx, navigate, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-[0_40px_100px_-30px_rgb(0_0_0/0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar na plataforma..."
            className="h-14 flex-1 bg-transparent text-[15px] font-semibold text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
          />
          <kbd className="hidden rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground md:block">
            ESC
          </kbd>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="p-8 text-center text-sm font-semibold text-muted-foreground">
              Nada encontrado para "{q}".
            </div>
          ) : (
            <ul className="flex flex-col">
              {results.map((r, i) => {
                const Icon = r.icon;
                const active = i === idx;
                return (
                  <li key={r.key}>
                    <button
                      type="button"
                      onMouseEnter={() => setIdx(i)}
                      onClick={() => {
                        navigate(r.path);
                        onClose();
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                        active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                          active ? "bg-white/20 text-white" : "bg-primary-soft text-primary",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className={cn("truncate text-sm font-extrabold", !active && "text-foreground")}>
                          {r.label}
                        </div>
                        <div className={cn("truncate text-xs font-semibold", active ? "text-white/80" : "text-muted-foreground")}>
                          {r.section}
                        </div>
                      </div>
                      {active && <CornerDownLeft className="h-4 w-4 shrink-0 opacity-80" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/40 px-4 py-2 text-[11px] font-bold text-muted-foreground">
          <span>Navegue com ↑ ↓ · Selecione com Enter</span>
          <span>{results.length} resultado(s)</span>
        </div>
      </div>
    </div>
  );
}
