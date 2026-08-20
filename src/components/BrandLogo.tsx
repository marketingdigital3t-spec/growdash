import { cn } from "@/lib/utils";
import { useAccentTheme } from "@/hooks/useAccentTheme";

export function BrandMark({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("brand-mark-tint block shrink-0", className)} />;
}

export function BrandLogo({ className, eager = false }: { className?: string; eager?: boolean }) {
  const { accent } = useAccentTheme();
  // Both files are RGBA PNGs. Selecting the authored gold bitmap avoids
  // tinting a white raster with CSS filters, which had inconsistent colour
  // and contrast between displays.
  const src = accent === "metallic-gold"
    ? "/growdash-brand-gold.png"
    : "/assets/growdash-logo-transparent.png";
  return <img src={src} alt="Growdash" decoding="async" loading={eager ? "eager" : "lazy"} className={cn("brand-logo-image block shrink-0 object-contain", className)} />;
}
