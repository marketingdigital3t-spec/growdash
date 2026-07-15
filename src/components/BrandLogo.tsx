import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return <img src="./growdash-mark-gold.svg" alt="" aria-hidden="true" className={cn("block object-contain", className)} />;
}

export function BrandLogo({ className, eager = false }: { className?: string; eager?: boolean }) {
  return (
    <img
      src="./growdash-brand-gold.svg"
      alt="Growdash"
      className={cn("block object-contain", className)}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
    />
  );
}
