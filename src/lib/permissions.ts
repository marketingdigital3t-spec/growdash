export type PermLevel = "view" | "edit";

export const MODULES: { id: string; label: string }[] = [
  { id: "agenda", label: "Agenda" },
  { id: "contatos", label: "Contatos" },
  { id: "atendimentos", label: "Atendimentos" },
  { id: "vendas", label: "Vendas" },
  { id: "financeiro", label: "Financeiro" },
  { id: "comissoes", label: "Comissões" },
  { id: "estoque", label: "Estoque" },
  { id: "comunicacao", label: "Comunicação" },
  { id: "chat-seguro", label: "Chat Seguro" },
  { id: "clinidocs", label: "CliniDocs" },
  { id: "marketing", label: "Marketing" },
  { id: "comunidade", label: "Comunidade" },
  { id: "config", label: "Configurações" },
];

/** Deriva o módulo a partir do path do menu. Ex: "/agenda/semana" -> "agenda". */
export function moduleFromPath(path: string): string {
  const seg = path.split("/").filter(Boolean)[0];
  return seg ?? "home";
}
