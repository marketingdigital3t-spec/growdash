export type EntityStatus =
  | "ACTIVE"
  | "PAUSED"
  | "ARCHIVED"
  | "DELETED"
  | "IN_PROCESS"
  | "WITH_ISSUES"
  | "CAMPAIGN_PAUSED"
  | "ADSET_PAUSED"
  | "PENDING_REVIEW"
  | "DISAPPROVED"
  | string
  | null
  | undefined;

export interface StatusBadge {
  label: string;
  dotColor: string;
  textColor: string;
}

export function getStatusBadge(status: EntityStatus): StatusBadge {
  switch ((status || "").toUpperCase()) {
    case "ACTIVE":
      return { label: "Ativa", dotColor: "bg-[#39ff14] shadow-[0_0_8px_rgba(57,255,20,0.9)]", textColor: "text-emerald-600" };
    case "PAUSED":
    case "CAMPAIGN_PAUSED":
    case "ADSET_PAUSED":
      return { label: "Pausada", dotColor: "bg-[#ff3131] shadow-[0_0_8px_rgba(255,49,49,0.85)]", textColor: "text-red-500" };
    case "ARCHIVED":
      return { label: "Arquivada", dotColor: "bg-amber-500", textColor: "text-amber-600" };
    case "DELETED":
      return { label: "Excluída", dotColor: "bg-red-500", textColor: "text-red-600" };
    case "IN_PROCESS":
    case "PENDING_REVIEW":
      return { label: "Em análise", dotColor: "bg-blue-500", textColor: "text-blue-600" };
    case "WITH_ISSUES":
    case "DISAPPROVED":
      return { label: "Com problemas", dotColor: "bg-red-500", textColor: "text-red-600" };
    default:
      return { label: "—", dotColor: "bg-muted-foreground/30", textColor: "text-muted-foreground" };
  }
}
