import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { applyPageSEO, getRoutePageTitle, readCompanySettings } from "@/lib/companySettings";

export function usePageSEO() {
  const location = useLocation();

  useEffect(() => {
    const apply = () => applyPageSEO(getRoutePageTitle(location.pathname), readCompanySettings());
    apply();
    window.addEventListener("growthos:company-settings-updated", apply);
    return () => window.removeEventListener("growthos:company-settings-updated", apply);
  }, [location.pathname]);
}
