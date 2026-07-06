import { useEffect, useMemo, useState } from "react";
import { ShieldAlert, ShieldCheck, Lock, Image as ImageIcon, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCrypto } from "@/hooks/useCrypto";
import { decryptText, decryptBytes } from "@/lib/crypto";
import { PageHeader } from "@/components/page-primitives";
import { Card, Button, Badge } from "@/components/list-primitives";
import WatermarkedImage from "@/components/WatermarkedImage";

type EscrowConv = {
  conversation_id: string;
  patient_id: string;
  professional_id: string;
  updated_at: string;
  patient_name: string;
  professional_name: string;
};

type Msg = {
  id: string;
  sender_id: string;
  kind: "text" | "photo";
  body: string | null;
  photo_path: string | null;
  iv: string | null;
  ciphertext: string | null;
  created_at: string;
  _decrypted?: string;
};

export default function Recuperacao() {
  const { user, roles } = useAuth();
  const { unlocked, getConvKey } = useCrypto();
  const isAdmin = roles.includes("admin");
  const [convs, setConvs] = useState<EscrowConv[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [reason, setReason] = useState("");
  const [reasonSaved, setReasonSaved] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  const load = async () => {
    if (!user) return;
    setLoading(true);
    // Todas as conversas nas quais eu (admin) tenho chave em escrow
    const { data: keys } = await supabase
      .from("conversation_keys")
      .select("conversation_id")
      .eq("recipient_id", user.id)
      .eq("is_admin_escrow", true);
    const ids = Array.from(new Set((keys ?? []).map((k) => k.conversation_id)));
    if (ids.length === 0) {
      setConvs([]);
      setLoading(false);
      return;
    }
    const { data: cs } = await supabase
      .from("conversations")
      .select("id, patient_id, professional_id, updated_at")
      .in("id", ids)
      .order("updated_at", { ascending: false });
    const partIds = new Set<string>();
    cs?.forEach((c) => {
      partIds.add(c.patient_id);
      partIds.add(c.professional_id);
    });
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", Array.from(partIds));
    const map: Record<string, string> = {};
    profs?.forEach((p) => (map[p.id] = p.full_name ?? "—"));
    setProfiles(map);
    setConvs(
      (cs ?? []).map((c) => ({
        conversation_id: c.id,
        patient_id: c.patient_id,
        professional_id: c.professional_id,
        updated_at: c.updated_at,
        patient_name: map[c.patient_id] ?? "Paciente",
        professional_name: map[c.professional_id] ?? "Profissional",
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin]);

  const openConversation = async (c: EscrowConv) => {
    if (!user) return;
    if (!reason.trim() || reason.trim().length < 10) {
      alert("Descreva o motivo da recuperação (mínimo 10 caracteres) — será registrado em auditoria.");
      return;
    }
    setActiveId(c.conversation_id);
    setMessages([]);
    // Registra auditoria imediatamente na abertura
    await supabase.from("audit_log").insert({
      actor_id: user.id,
      action: "admin_conversation_recovery_open",
      target_type: "conversation",
      target_id: c.conversation_id,
      metadata: { reason: reason.trim() } as unknown as never,
    });
    await supabase.from("security_events").insert({
      user_id: user.id,
      event_type: "admin_recovery_conversation_open",
      metadata: { conversation_id: c.conversation_id, reason: reason.trim() } as unknown as never,
    });
    setReasonSaved((r) => ({ ...r, [c.conversation_id]: reason.trim() }));
    setReason("");

    const { data } = await supabase
      .from("messages")
      .select("id, sender_id, kind, body, photo_path, iv, ciphertext, created_at")
      .eq("conversation_id", c.conversation_id)
      .order("created_at", { ascending: true });
    const raw = (data as Msg[]) ?? [];
    let key: CryptoKey | null = null;
    try {
      key = await getConvKey(c.conversation_id);
    } catch {
      setMessages(raw.map((m) => ({ ...m, _decrypted: "🔒 Sem chave de escrow para esta conversa" })));
      return;
    }
    const dec = await Promise.all(
      raw.map(async (m) => {
        if (m.kind === "text" && m.iv && m.ciphertext) {
          try {
            return { ...m, _decrypted: await decryptText(m.iv, m.ciphertext, key!) };
          } catch {
            return { ...m, _decrypted: "🔒 Falha ao descriptografar" };
          }
        }
        if (m.kind === "text") return { ...m, _decrypted: m.body ?? "" };
        return m;
      }),
    );
    setMessages(dec);
  };

  const openPhoto = async (m: Msg) => {
    if (!m.photo_path || !activeId) return;
    try {
      const { data, error } = await supabase.functions.invoke("signed-photo-url", {
        body: { message_id: m.id },
      });
      if (error || !data?.url) throw new Error("Sem acesso à foto");
      const res = await fetch(data.url);
      const buf = new Uint8Array(await res.arrayBuffer());
      const iv = buf.slice(0, 12);
      const ct = buf.slice(12);
      const key = await getConvKey(activeId);
      const plain = await decryptBytes(iv, ct, key);
      const blob = new Blob([new Uint8Array(plain)]);
      setLightbox(URL.createObjectURL(blob));
    } catch (e) {
      alert("Não foi possível abrir a foto: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const active = useMemo(() => convs.find((c) => c.conversation_id === activeId) ?? null, [convs, activeId]);
  const viewer = {
    name: (user?.user_metadata?.full_name as string) || "Admin",
    email: user?.email ?? "",
  };

  if (!isAdmin) {
    return (
      <div className="p-6 md:p-8">
        <PageHeader breadcrumb={["Clínica", "Chat Seguro", "Recuperação"]} title="Acesso restrito" />
        <Card>
          <div className="flex items-center gap-3 text-sm font-semibold text-muted-foreground">
            <ShieldAlert className="h-5 w-5 text-[hsl(0_70%_50%)]" />
            Somente administradores da clínica podem usar a recuperação por escrow.
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Chat Seguro", "Recuperação"]}
        title="Recuperação de conversas"
        subtitle="Uso administrativo excepcional — todo acesso é auditado e registrado."
        actions={<Button variant="secondary" onClick={load}><RefreshCw className="h-4 w-4" /> Recarregar</Button>}
      />

      {!unlocked && (
        <Card>
          <div className="flex items-center gap-3 text-sm font-semibold">
            <Lock className="h-5 w-5 text-[hsl(35_85%_45%)]" />
            <span>Desbloqueie o seu cofre pessoal (na tela do Chat Seguro) para poder abrir as chaves de escrow.</span>
          </div>
        </Card>
      )}

      <div className="mt-4 rounded-2xl border border-[hsl(0_85%_92%)] bg-[hsl(0_85%_98%)] p-4 text-sm">
        <div className="mb-1 flex items-center gap-2 font-extrabold text-[hsl(0_70%_45%)]">
          <ShieldAlert className="h-4 w-4" /> Aviso legal (LGPD art. 11)
        </div>
        <p className="font-semibold text-[hsl(0_60%_35%)]">
          Fotos e mensagens contêm dados sensíveis de saúde. Só recupere conversas mediante solicitação formal, autorização
          da titular ou determinação judicial. O motivo abaixo é obrigatório e ficará registrado.
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card title="Conversas com chave em escrow" subtitle={loading ? "Carregando..." : `${convs.length} conversas disponíveis`}>
          <div className="mb-3">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Motivo da próxima recuperação
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: solicitação formal da paciente (protocolo #123) para exportar histórico."
              className="min-h-[80px] w-full rounded-xl border border-border bg-card p-3 text-sm font-semibold text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <ul className="max-h-[420px] overflow-auto divide-y divide-border">
            {convs.length === 0 && !loading && (
              <li className="py-6 text-center text-sm font-semibold text-muted-foreground">
                Nenhuma conversa com escrow disponível.
              </li>
            )}
            {convs.map((c) => (
              <li key={c.conversation_id}>
                <button
                  onClick={() => openConversation(c)}
                  className={`w-full rounded-xl px-3 py-3 text-left transition-colors ${
                    activeId === c.conversation_id ? "bg-primary-soft" : "hover:bg-muted/40"
                  }`}
                >
                  <p className="text-sm font-extrabold text-foreground">{c.patient_name}</p>
                  <p className="text-xs font-semibold text-muted-foreground">
                    com {c.professional_name} • {new Date(c.updated_at).toLocaleDateString("pt-BR")}
                  </p>
                  {reasonSaved[c.conversation_id] && (
                    <div className="mt-1"><Badge tone="green">Acessada nesta sessão</Badge></div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <div className="lg:col-span-2">
          {!active ? (
            <Card>
              <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
                <ShieldCheck className="mb-3 h-10 w-10 text-primary" />
                <p className="text-base font-extrabold text-foreground">Selecione uma conversa</p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Preencha o motivo e clique em uma conversa à esquerda. O sistema abrirá o histórico usando a
                  chave em escrow deste admin.
                </p>
              </div>
            </Card>
          ) : (
            <Card
              title={`${active.patient_name} × ${active.professional_name}`}
              subtitle={`Motivo registrado: ${reasonSaved[active.conversation_id] ?? "—"}`}
            >
              <div className="mb-3 flex items-center gap-2 text-xs font-bold text-[hsl(0_70%_45%)]">
                <ShieldAlert className="h-3 w-3" /> Toda visualização foi registrada em auditoria com seu ID.
              </div>
              <div className="max-h-[520px] space-y-3 overflow-auto pr-2">
                {messages.length === 0 && (
                  <p className="py-6 text-center text-sm font-semibold text-muted-foreground">Sem mensagens.</p>
                )}
                {messages.map((m) => {
                  const mine = m.sender_id === active.patient_id ? "patient" : "professional";
                  return (
                    <div key={m.id} className="rounded-2xl border border-border bg-muted/30 p-3">
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs font-bold text-muted-foreground">
                        <span>
                          {mine === "patient" ? active.patient_name : active.professional_name} •{" "}
                          {new Date(m.created_at).toLocaleString("pt-BR")}
                        </span>
                        <Badge tone={m.kind === "photo" ? "pink" : "neutral"}>{m.kind === "photo" ? "Foto" : "Texto"}</Badge>
                      </div>
                      {m.kind === "text" ? (
                        <p className="text-sm font-semibold text-foreground">{m._decrypted}</p>
                      ) : (
                        <button
                          onClick={() => openPhoto(m)}
                          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold text-foreground hover:bg-muted"
                        >
                          <ImageIcon className="h-4 w-4" /> Ver foto (com marca d'água)
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      </div>

      {lightbox && <WatermarkedImage src={lightbox} viewer={viewer} onClose={() => { URL.revokeObjectURL(lightbox); setLightbox(null); }} />}
    </div>
  );
}
