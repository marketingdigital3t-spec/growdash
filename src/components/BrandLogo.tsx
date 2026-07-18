import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("brand-mark-tint block shrink-0", className)} />;
}

export function BrandLogo({ className, eager = false }: { className?: string; eager?: boolean }) {
  void eager;
  return (
    <span role="img" aria-label="Growdash" className={cn("brand-logo-tint block shrink-0", className)} />
  );
}
