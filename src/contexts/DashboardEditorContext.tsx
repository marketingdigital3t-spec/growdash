import { createContext, useContext, useState, type ReactNode } from "react";

export type DashboardEditorItem = {
  type: string;
  title: string;
  description: string;
  category: string;
  enabled: boolean;
};

export type DashboardEditorController = {
  title: string;
  items: DashboardEditorItem[];
  saving: boolean;
  onToggle: (type: string) => void;
  onReset: () => void;
  onCancel: () => void;
  onSave: () => void;
};

type DashboardEditorContextValue = {
  editor: DashboardEditorController | null;
  setEditor: (editor: DashboardEditorController | null) => void;
};

const DashboardEditorContext = createContext<DashboardEditorContextValue | null>(null);

export function DashboardEditorProvider({ children }: { children: ReactNode }) {
  const [editor, setEditor] = useState<DashboardEditorController | null>(null);
  return <DashboardEditorContext.Provider value={{ editor, setEditor }}>{children}</DashboardEditorContext.Provider>;
}

export function useDashboardEditor() {
  const value = useContext(DashboardEditorContext);
  if (!value) throw new Error("useDashboardEditor precisa estar dentro de DashboardEditorProvider");
  return value;
}
