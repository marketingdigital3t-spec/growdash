import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const LGPD_VERSION = "1.0-2026-07";

export default function LgpdConsent() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("lgpd_consents")
        .select("id")
        .eq("user_id", user.id)
        .eq("version", LGPD_VERSION)
        .maybeSingle();
      setOpen(!data);
      setChecking(false);
    })();
  }, [user]);

  const accept = async () => {
    if (!user) return;
    await supabase.from("lgpd_consents").insert({ user_id: user.id, version: LGPD_VERSION });
    setOpen(false);
  };

  if (checking || !open) return null;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-black">Termo de consentimento — LGPD</h2>
        </div>
        <div className="max-h-[50vh] overflow-y-auto text-sm text-foreground/85 space-y-3">
          <p>
            O <b>Chat Seguro</b> da clinicnext é utilizado para envio de mensagens e fotos de acompanhamento
            pós-procedimento entre você e a profissional responsável.
          </p>
          <p>
            <b>Dado sensível de saúde (art. 11, Lei 13.709/2018).</b> As fotos são armazenadas de forma
            criptografada, com acesso restrito exclusivamente a você e à sua profissional vinculada. Nenhuma
            outra pessoa da clínica tem acesso.
          </p>
          <p>
            <b>Uso.</b> As imagens serão usadas somente para acompanhamento clínico. Não serão utilizadas em
            redes sociais, materiais publicitários ou compartilhadas com terceiros.
          </p>
          <p>
            <b>Seus direitos.</b> Você pode solicitar a exclusão de qualquer mensagem ou foto a qualquer momento,
            bem como revogar este consentimento e pedir a exclusão total dos seus dados.
          </p>
          <p>Versão do termo: {LGPD_VERSION}</p>
        </div>
        <button
          onClick={accept}
          className="mt-5 h-11 w-full rounded-xl bg-primary font-bold text-primary-foreground shadow-lg hover:opacity-90"
        >
          Li e aceito
        </button>
      </div>
    </div>
  );
}
