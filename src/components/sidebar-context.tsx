import { createContext, useContext, useState, type ReactNode } from "react";

type Ctx = { expanded: boolean; toggle: () => void; setExpanded: (v: boolean) => void };
const SidebarCtx = createContext<Ctx | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <SidebarCtx.Provider value={{ expanded, setExpanded, toggle: () => setExpanded((v) => !v) }}>
      {children}
    </SidebarCtx.Provider>
  );
}

export function useSidebar() {
  const c = useContext(SidebarCtx);
  if (!c) throw new Error("useSidebar must be used inside SidebarProvider");
  return c;
}
