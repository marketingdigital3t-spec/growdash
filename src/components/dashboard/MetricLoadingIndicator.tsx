import { LoaderCircle } from "lucide-react";

/** Compact loading state for metric values while the last snapshot is refreshed. */
export function MetricLoadingIndicator({ label = "Carregando métrica" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5" role="status" aria-label={label}>
      <LoaderCircle className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
