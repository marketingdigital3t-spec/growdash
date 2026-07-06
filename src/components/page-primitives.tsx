import { ReactNode } from "react";

export function PageHeader({
  breadcrumb,
  title,
  subtitle,
  actions,
}: {
  breadcrumb: string[];
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        {breadcrumb.map((b, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className={i === breadcrumb.length - 1 ? "text-primary" : "text-muted-foreground"}>
              {b}
            </span>
            {i < breadcrumb.length - 1 && <span className="text-muted-foreground">/</span>}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent = "primary",
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "primary" | "pink" | "green" | "yellow";
  icon?: ReactNode;
}) {
  const accentBg = {
    primary: "bg-primary-soft text-primary",
    pink: "bg-[hsl(340_90%_96%)] text-[hsl(340_85%_55%)]",
    green: "bg-[hsl(145_65%_92%)] text-[hsl(145_60%_35%)]",
    yellow: "bg-[hsl(42_100%_94%)] text-[hsl(35_85%_45%)]",
  }[accent];

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-muted-foreground">{label}</span>
        {icon && (
          <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${accentBg}`}>
            {icon}
          </span>
        )}
      </div>
      <div className="text-2xl font-extrabold text-foreground">{value}</div>
      {hint && <p className="mt-1 text-xs font-semibold text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Button({
  variant = "primary",
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  const styles = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_8px_22px_-8px_hsl(var(--primary)/0.55)]",
    secondary: "border border-border bg-card text-foreground hover:bg-muted",
    ghost: "text-foreground/80 hover:bg-muted",
  }[variant];
  return (
    <button
      className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-10 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${className}`}
      {...props}
    />
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "primary" | "pink" | "green" | "yellow" | "red";
}) {
  const styles = {
    neutral: "bg-muted text-foreground/70",
    primary: "bg-primary-soft text-primary",
    pink: "bg-[hsl(340_90%_96%)] text-[hsl(340_85%_55%)]",
    green: "bg-[hsl(145_65%_92%)] text-[hsl(145_60%_35%)]",
    yellow: "bg-[hsl(42_100%_94%)] text-[hsl(35_85%_45%)]",
    red: "bg-[hsl(0_85%_95%)] text-[hsl(0_70%_50%)]",
  }[tone];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${styles}`}>
      {children}
    </span>
  );
}
