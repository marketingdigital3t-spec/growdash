import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("brand-mark-tint block shrink-0", className)} />;
}

export function BrandLogo({ className, eager = false }: { className?: string; eager?: boolean }) {
  // The transparent raster is the canonical wordmark. The platform themes
  // recolour the shell around it, so a single asset works in both themes.
  return <img src="/assets/growdash-logo-transparent.png" alt="Growdash" decoding="async" loading={eager ? "eager" : "lazy"} className={cn("brand-logo-image block shrink-0 object-contain", className)} />;
}
