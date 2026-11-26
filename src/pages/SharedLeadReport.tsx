import { useQuery } from "@tanstack/react-query";
import { Navigate, useParams } from "react-router-dom";
import { ReportPresentation, type ReportSnapshot } from "@/growdash/LeadReportStudio";
import { supabase } from "@/integrations/supabase/client";

export default function SharedLeadReport() {
  const { shareToken } = useParams();
  const report = useQuery({ queryKey: ["shared-lead-report", shareToken], enabled: !!shareToken, retry: 1, queryFn: async () => { const { data, error } = await supabase.rpc("get_shared_lead_report", { p_token: shareToken! }); if (error) throw error; if (!data || typeof data !== "object" || Array.isArray(data) || !("payload" in data)) throw new Error("Relatório não encontrado"); return data.payload as unknown as ReportSnapshot; } });
  if (!shareToken) return <Navigate to="/" replace />;
  if (report.isLoading) return <div className="grid min-h-screen place-items-center bg-[#050505] text-white"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (report.error || !report.data) return <div className="grid min-h-screen place-items-center bg-[#050505] px-6 text-center text-white"><div><h1 className="text-2xl font-black">Relatório indisponível</h1><p className="mt-2 text-sm text-white/55">O link pode ter sido removido ou tornado privado.</p></div></div>;
  return <ReportPresentation report={report.data} />;
}
