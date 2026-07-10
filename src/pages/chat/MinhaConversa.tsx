import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Download, Lock, RefreshCw, Send, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCrypto } from "@/hooks/useCrypto";
import { encryptText, decryptText, encryptBytes, decryptBytes, b64 } from "@/lib/crypto";
import LgpdConsent from "@/components/LgpdConsent";
import WatermarkedImage from "@/components/WatermarkedImage";

type Conversation = {
  id: string;
  patient_id: string;
  professional_id: string;
  updated_at: string;
  access_code: string;
  professional_name: string;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  kind: "text" | "photo";
  body: string | null;
  photo_path: string | null;
  iv: string | null;
  ciphertext: string | null;
  created_at: string;
  _decrypted?: string;
};

/**
 * Tela isolada da paciente:
 * - Só existe UMA conversa (com a clínica).
 * - Sem sidebar. Só vê a própria conversa.
 * - Precisa digitar o código individual da conversa.
 * - Botões LGPD: exportar dados e solicitar exclusão de fotos.
 */
export default function MinhaConversa() {
  const { user } = useAuth();
  const { getConvKey, createConversationKey, shareConversationKey } = useCrypto();
  const [conv, setConv] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<{ id: string; deadline_at: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoCache = useRef<Map<string, string>>(new Map());

  const viewer = useMemo(
    () => ({
      name: (user?.user_metadata?.full_name as string) || "Você",
      email: user?.email ?? "",
    }),
    [user],
  );

  const loadConversation = async () => {
    if (!user) return;
    setLoading(true);
    const { data: convs } = await supabase
      .from("conversations")
      .select("id, patient_id, professional_id, updated_at, access_code")
      .eq("patient_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1);
    const first = convs?.[0];
    if (!first) {
      setConv(null);
      setLoading(false);
      return;
    }
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", first.professional_id)
      .maybeSingle();
    setConv({
      ...first,
      professional_name: prof?.full_name ?? "Sua profissional",
    });
    setLoading(false);
  };

  const loadPendingRequest = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("data_deletion_requests")
      .select("id, deadline_at")
      .eq("patient_id", user.id)
      .in("status", ["pending", "approved"])
      .order("requested_at", { ascending: false })
      .limit(1);
    setPendingRequest(data?.[0] ?? null);
  };

  useEffect(() => {
    loadConversation();
    loadPendingRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const prepareKey = async (conversationId: string) => {
    // getConvKey já cacheia + re-compartilha 1x em background — não bloqueia hot path
    return getConvKey(conversationId);
  };

  const decryptMessage = async (m: Message, conversationId: string): Promise<Message> => {
    if (m.kind !== "text") return m;
    if (m._decrypted) return m;
    if (m.iv && m.ciphertext) {
      try {
        const key = await prepareKey(conversationId);
        return { ...m, _decrypted: await decryptText(m.iv, m.ciphertext, key) };
      } catch {
        return { ...m, _decrypted: "🔒 Não foi possível descriptografar" };
      }
    }
    return { ...m, _decrypted: m.body ?? "" };
  };

  useEffect(() => {
    if (!conv || !unlocked) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      const raw = (data as Message[]) ?? [];
      const decrypted = await Promise.all(raw.map((m) => decryptMessage(m, conv.id)));
      if (!cancelled) setMessages(decrypted);
    })();
    const ch = supabase
      .channel(`patient-msg-${conv.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conv.id}` },
        async (payload) => {
          const dec = await decryptMessage(payload.new as Message, conv.id);
          setMessages((m) => (m.some((x) => x.id === dec.id) ? m : [...m, dec]));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `conversation_id=eq.${conv.id}` },
        (payload) => setMessages((m) => m.filter((x) => x.id !== (payload.old as Message).id)),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv?.id, unlocked]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const startConversationWithClinic = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: admins, error: aerr } = await supabase.from("clinic_admins").select("user_id").limit(1);
      if (aerr) throw aerr;
      const adminId = admins?.[0]?.user_id;
      if (!adminId) throw new Error("Nenhuma profissional disponível na clínica ainda.");
      const { data: pubKey } = await supabase
        .from("user_keys")
        .select("user_id")
        .eq("user_id", adminId)
        .maybeSingle();
      if (!pubKey) throw new Error("A profissional ainda não configurou o cofre. Tente em instantes.");
      const { data: newConv, error } = await supabase
        .from("conversations")
        .insert({ patient_id: user.id, professional_id: adminId })
        .select()
        .single();
      if (error) throw error;
      await createConversationKey(newConv.id, adminId);
      await loadConversation();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const unlock = async () => {
    if (!conv) return;
    const norm = (s: string) => s.trim().toUpperCase().replace(/O/g, "0").replace(/[IL]/g, "1");
    if (norm(pwInput) !== norm(conv.access_code)) {
      setPwError("Código incorreto neste aparelho.");
      return;
    }
    try {
      await prepareKey(conv.id);
      setUnlocked(true);
      setPwInput("");
      setPwError(null);
    } catch (e) {
      setPwError(e instanceof Error ? e.message : "Não foi possível abrir a conversa.");
    }
  };

  const rotateCode = async () => {
    if (!conv) return;
    if (!confirm("Gerar um novo código? O código atual deixará de funcionar em todos os aparelhos.")) return;
    try {
      const { data, error } = await supabase.rpc("rotate_conversation_access_code", {
        _conversation_id: conv.id,
      });
      if (error) throw error;
      const newCode = String(data);
      setConv({ ...conv, access_code: newCode });
      setUnlocked(false);
      alert(`Seu novo código: ${newCode}\n\nGuarde com segurança.`);
    } catch (e) {
      alert("Falha ao renovar: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const sendText = async () => {
    if (!conv || !text.trim() || !user) return;
    const body = text.trim();
    setText("");
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: Message = {
      id: tempId,
      conversation_id: conv.id,
      sender_id: user.id,
      kind: "text",
      body: null,
      photo_path: null,
      iv: null,
      ciphertext: null,
      created_at: new Date().toISOString(),
      _decrypted: body,
    };
    setMessages((m) => [...m, optimistic]);
    try {
      const key = await prepareKey(conv.id);
      const { iv, ciphertext } = await encryptText(body, key);
      const { data, error } = await supabase.from("messages").insert({
        conversation_id: conv.id,
        sender_id: user.id,
        kind: "text",
        iv,
        ciphertext,
      }).select().single();
      if (error) throw error;
      setMessages((m) => {
        const withoutTemp = m.filter((x) => x.id !== tempId);
        if (withoutTemp.some((x) => x.id === data.id)) return withoutTemp;
        return [...withoutTemp, { ...(data as Message), _decrypted: body }];
      });
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== tempId));
      alert("Falha ao enviar: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const sendPhoto = async (file: File) => {
    if (!conv || !user) return;
    if (file.size > 10 * 1024 * 1024) return alert("Foto acima de 10MB");
    setUploading(true);
    try {
      const key = await prepareKey(conv.id);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { iv, ciphertext } = await encryptBytes(bytes, key);
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const { data, error } = await supabase.functions.invoke("upload-photo", {
        body: {
          conversation_id: conv.id,
          iv_base64: b64.encode(iv),
          ciphertext_base64: b64.encode(ciphertext),
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (error) throw error;
      if (data?.message) {
        setMessages((m) => (m.some((x) => x.id === data.message.id) ? m : [...m, data.message]));
      }
    } catch (e) {
      alert("Falha ao enviar foto: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setUploading(false);
    }
  };

  const openPhoto = async (msg: Message) => {
    if (!msg.photo_path || !conv) return;
    const cached = photoCache.current.get(msg.id);
    if (cached) {
      setLightbox(cached);
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("signed-photo-url", {
        body: { message_id: msg.id },
      });
      if (error || !data?.url) throw new Error("Sem acesso à foto");
      const res = await fetch(data.url);
      if (!res.ok) throw new Error("Falha no download");
      const buf = new Uint8Array(await res.arrayBuffer());
      const iv = buf.slice(0, 12);
      const ct = buf.slice(12);
      const key = await prepareKey(conv.id);
      const plain = await decryptBytes(iv, ct, key);
      const blob = new Blob([new Uint8Array(plain)]);
      const url = URL.createObjectURL(blob);
      photoCache.current.set(msg.id, url);
      setLightbox(url);
    } catch (e) {
      alert("Não foi possível abrir a foto: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const exportMyData = async () => {
    if (!conv || !user) return;
    try {
      const { data } = await supabase
        .from("messages")
        .select("id, sender_id, kind, iv, ciphertext, body, photo_path, created_at")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true });
      const raw = (data as Message[]) ?? [];
      const key = await prepareKey(conv.id);
      const decrypted = await Promise.all(
        raw.map(async (m) => {
          if (m.kind === "text" && m.iv && m.ciphertext) {
            try {
              return { ...m, text_plain: await decryptText(m.iv, m.ciphertext, key) };
            } catch {
              return { ...m, text_plain: null };
            }
          }
          return m;
        }),
      );
      const payload = {
        exported_at: new Date().toISOString(),
        patient: { id: user.id, email: user.email, name: viewer.name },
        conversation: {
          id: conv.id,
          professional_name: conv.professional_name,
        },
        messages: decrypted,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meus-dados-chat-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      await supabase.from("audit_log").insert({
        actor_id: user.id,
        action: "data_exported",
        target_type: "conversation",
        target_id: conv.id,
      });
    } catch (e) {
      alert("Falha ao exportar: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const requestPhotoDeletion = async () => {
    if (!conv || !user) return;
    if (
      !confirm(
        "Confirmar solicitação de exclusão de TODAS as suas fotos desta conversa?\n\nA clínica tem até 7 dias para atender ao pedido (LGPD, Art. 18).",
      )
    )
      return;
    try {
      const { data, error } = await supabase
        .from("data_deletion_requests")
        .insert({
          patient_id: user.id,
          conversation_id: conv.id,
          scope: "photos",
          status: "pending",
        })
        .select("id, deadline_at")
        .single();
      if (error) throw error;
      setPendingRequest(data);
      await supabase.from("audit_log").insert({
        actor_id: user.id,
        action: "deletion_requested",
        target_type: "conversation",
        target_id: conv.id,
        metadata: { scope: "photos" },
      });
      alert("Pedido registrado. Você receberá um retorno em até 7 dias.");
    } catch (e) {
      alert("Falha ao registrar pedido: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  if (loading) {
    return <div className="grid h-full place-items-center text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <>
      <LgpdConsent />
      <div className="mx-auto flex h-full max-w-2xl flex-col">
        <div className="flex items-center gap-3 border-b border-border bg-card px-6 py-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow">
            <Lock className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-black">
              {conv ? conv.professional_name : "Meu Chat Seguro"}
            </h1>
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3 w-3" /> E2E · AES-256-GCM · LGPD art. 11
            </p>
          </div>
          {conv && (
            <button
              onClick={() => setShowCode((s) => !s)}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 font-mono text-[11px] font-bold tracking-widest"
              title={showCode ? "Ocultar código" : "Mostrar código da conversa"}
            >
              <Lock className="h-3 w-3" />
              {showCode ? conv.access_code : "••••••"}
            </button>
          )}
        </div>

        {!conv ? (
          <div className="grid flex-1 place-items-center bg-background p-8 text-center">
            <div className="max-w-sm">
              <p className="mb-4 text-sm text-muted-foreground">
                Você ainda não iniciou sua conversa com a clínica.
              </p>
              <button
                onClick={startConversationWithClinic}
                className="h-11 rounded-xl bg-primary px-6 font-bold text-primary-foreground shadow hover:opacity-90"
              >
                Iniciar conversa com a clínica
              </button>
            </div>
          </div>
        ) : !unlocked ? (
          <div className="grid flex-1 place-items-center bg-background p-8">
            <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-xl">
              <h3 className="mb-1 text-base font-black">Digite o código da sua conversa</h3>
              <p className="mb-4 text-xs text-muted-foreground">
                O código foi entregue pela sua profissional. Cada aparelho precisa digitar o código para abrir a conversa.
              </p>
              <input
                autoFocus
                value={pwInput}
                onChange={(e) => {
                  setPwInput(e.target.value);
                  setPwError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && unlock()}
                placeholder="Ex.: 3E2EFB"
                maxLength={6}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 font-mono text-sm uppercase tracking-widest outline-none focus:border-primary"
              />
              {pwError && (
                <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{pwError}</p>
              )}
              <button
                onClick={unlock}
                className="mt-3 h-11 w-full rounded-xl bg-primary font-bold text-primary-foreground shadow hover:opacity-90"
              >
                Abrir conversa
              </button>
              <button
                onClick={rotateCode}
                className="mt-2 h-10 w-full rounded-xl border border-border text-xs font-bold hover:bg-muted"
              >
                <RefreshCw className="mr-1 inline h-3 w-3" /> Perdi o código — gerar um novo
              </button>
            </div>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-background px-6 py-4">
              {messages.length === 0 ? (
                <p className="pt-8 text-center text-xs text-muted-foreground">
                  Nenhuma mensagem ainda. Envie sua primeira mensagem à sua profissional.
                </p>
              ) : (
                messages.map((m) => (
                  <PatientBubble
                    key={m.id}
                    msg={m}
                    isMe={m.sender_id === user?.id}
                    onOpenPhoto={() => openPhoto(m)}
                  />
                ))
              )}
            </div>

            <div className="border-t border-border bg-card p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={exportMyData}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-bold hover:bg-muted"
                    title="Baixar todos os seus dados desta conversa em JSON"
                  >
                    <Download className="h-3 w-3" /> Exportar meus dados
                  </button>
                  <button
                    onClick={requestPhotoDeletion}
                    disabled={!!pendingRequest}
                    className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 font-bold text-destructive hover:bg-destructive/10 disabled:opacity-60"
                    title="Enviar pedido formal de exclusão de todas as suas fotos"
                  >
                    <Trash2 className="h-3 w-3" /> Solicitar exclusão de fotos
                  </button>
                  <button
                    onClick={rotateCode}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-bold hover:bg-muted"
                    title="Gerar um novo código de acesso"
                  >
                    <RefreshCw className="h-3 w-3" /> Renovar código
                  </button>
                </div>
                <button
                  onClick={() => setUnlocked(false)}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-bold hover:bg-muted"
                >
                  <Lock className="h-3 w-3" /> Bloquear
                </button>
              </div>
              {pendingRequest && (
                <div className="mb-2 flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-200">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Pedido de exclusão em análise · prazo até{" "}
                  {new Date(pendingRequest.deadline_at).toLocaleDateString("pt-BR")}
                </div>
              )}
              <div className="flex items-end gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) sendPhoto(f);
                    e.target.value = "";
                  }}
                />
                <button
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-background text-muted-foreground hover:text-primary disabled:opacity-50"
                  title="Enviar foto criptografada"
                >
                  <Camera className="h-5 w-5" />
                </button>
                <textarea
                  rows={1}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendText();
                    }
                  }}
                  placeholder="Escreva uma mensagem..."
                  className="max-h-32 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
                <button
                  onClick={sendText}
                  disabled={!text.trim()}
                  className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow disabled:opacity-40"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
              {uploading && <p className="mt-2 text-xs text-muted-foreground">Criptografando e enviando foto…</p>}
            </div>
          </>
        )}
      </div>

      {lightbox && (
        <WatermarkedImage
          src={lightbox}
          viewer={viewer}
          onClose={() => {
            // Mantém cache — reabertura instantânea
            setLightbox(null);
          }}
        />
      )}
    </>
  );
}

function PatientBubble({
  msg,
  isMe,
  onOpenPhoto,
}: {
  msg: Message;
  isMe: boolean;
  onOpenPhoto: () => void;
}) {
  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm ${
          isMe ? "bg-primary text-primary-foreground" : "bg-card border border-border"
        }`}
      >
        {msg.kind === "text" ? (
          <p className="whitespace-pre-wrap break-words text-sm">{msg._decrypted ?? "…"}</p>
        ) : (
          <button onClick={onOpenPhoto} className="flex items-center gap-2 text-sm font-semibold hover:underline">
            <Camera className="h-4 w-4" /> Ver foto de acompanhamento
          </button>
        )}
        <p className={`mt-1 text-[10px] ${isMe ? "text-white/70" : "text-muted-foreground"}`}>
          {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}
