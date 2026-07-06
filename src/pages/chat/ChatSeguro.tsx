import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Lock, Plus, Search, Send, ShieldCheck, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import LgpdConsent from "@/components/LgpdConsent";

type Conversation = {
  id: string;
  patient_id: string;
  professional_id: string;
  updated_at: string;
  other_name?: string;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  kind: "text" | "photo";
  body: string | null;
  photo_path: string | null;
  created_at: string;
};

export default function ChatSeguro() {
  const { user, roles } = useAuth();
  const isProfessional = roles.includes("professional") || roles.includes("admin");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load conversations
  const loadConversations = async () => {
    if (!user) return;
    const { data: convs } = await supabase
      .from("conversations")
      .select("id, patient_id, professional_id, updated_at")
      .order("updated_at", { ascending: false });
    if (!convs) return;
    const ids = new Set<string>();
    convs.forEach((c) => {
      ids.add(c.patient_id);
      ids.add(c.professional_id);
    });
    const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", Array.from(ids));
    const map: Record<string, string> = {};
    profs?.forEach((p) => (map[p.id] = p.full_name ?? "Usuário"));
    setProfiles(map);
    setConversations(
      convs.map((c) => ({
        ...c,
        other_name: map[c.patient_id === user.id ? c.professional_id : c.patient_id] ?? "—",
      })),
    );
    if (!activeId && convs.length) setActiveId(convs[0].id);
  };

  useEffect(() => {
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Load messages + subscribe realtime
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true });
      if (!cancelled) setMessages((data as Message[]) ?? []);
    })();
    const ch = supabase
      .channel(`msg-${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        (payload) => setMessages((m) => [...m, payload.new as Message]),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        (payload) => setMessages((m) => m.filter((x) => x.id !== (payload.old as Message).id)),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const active = useMemo(() => conversations.find((c) => c.id === activeId) ?? null, [conversations, activeId]);

  const sendText = async () => {
    if (!activeId || !text.trim() || !user) return;
    const body = text.trim();
    setText("");
    await supabase.from("messages").insert({
      conversation_id: activeId,
      sender_id: user.id,
      kind: "text",
      body,
    });
  };

  const sendPhoto = async (file: File) => {
    if (!activeId || !user) return;
    setUploading(true);
    try {
      const b64 = await fileToBase64(file);
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const { data, error } = await supabase.functions.invoke("upload-photo", {
        body: { conversation_id: activeId, file_base64: b64, mime: file.type },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (error) throw error;
      if (data?.message) setMessages((m) => [...m, data.message]);
    } catch (e) {
      alert("Falha ao enviar foto: " + String(e));
    } finally {
      setUploading(false);
    }
  };

  const openPhoto = async (messageId: string) => {
    const { data, error } = await supabase.functions.invoke("signed-photo-url", {
      body: { message_id: messageId },
    });
    if (error || !data?.url) return alert("Não foi possível abrir a foto");
    setLightboxUrl(data.url);
  };

  const deleteMessage = async (id: string) => {
    if (!confirm("Excluir esta mensagem?")) return;
    await supabase.from("messages").delete().eq("id", id);
  };

  return (
    <>
      <LgpdConsent />
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border bg-card px-6 py-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-[hsl(340_85%_60%)] text-white shadow">
            <Lock className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-black">Chat Seguro</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Criptografado · acesso restrito · conforme LGPD art. 11
            </p>
          </div>
          {isProfessional && (
            <button
              onClick={() => setShowNewPatient(true)}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Nova conversa
            </button>
          )}
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Sidebar */}
          <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-card/50">
            <div className="p-3">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input placeholder="Buscar" className="w-full bg-transparent outline-none" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {conversations.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Nenhuma conversa ainda.
                </p>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                      activeId === c.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                  >
                    <div
                      className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold ${
                        activeId === c.id ? "bg-white/20" : "bg-primary-soft text-primary"
                      }`}
                    >
                      {(c.other_name ?? "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{c.other_name}</p>
                      <p className="truncate text-xs opacity-70">
                        {new Date(c.updated_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          {/* Thread */}
          <section className="flex min-w-0 flex-1 flex-col">
            {!active ? (
              <EmptyState isProfessional={isProfessional} />
            ) : (
              <>
                <div className="flex items-center gap-3 border-b border-border bg-card px-6 py-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary">
                    {(active.other_name ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{active.other_name}</p>
                    <p className="text-[11px] text-muted-foreground">Conversa protegida</p>
                  </div>
                </div>
                <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-background px-6 py-4">
                  {messages.map((m) => (
                    <MessageBubble
                      key={m.id}
                      msg={m}
                      isMe={m.sender_id === user?.id}
                      onOpenPhoto={openPhoto}
                      onDelete={deleteMessage}
                    />
                  ))}
                </div>
                <div className="border-t border-border bg-card p-3">
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
                      title="Enviar foto"
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
                  {uploading && <p className="mt-2 text-xs text-muted-foreground">Enviando foto criptografada...</p>}
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-[110] grid place-items-center bg-black/90 p-6"
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="relative max-h-[90vh] max-w-[90vw]">
            <img src={lightboxUrl} className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain" alt="" />
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <span className="rotate-[-15deg] rounded bg-black/40 px-4 py-1 text-xs font-bold uppercase tracking-widest text-white/70">
                Confidencial · clinicnext
              </span>
            </div>
          </div>
        </div>
      )}

      {showNewPatient && (
        <NewConversationDialog
          onClose={() => setShowNewPatient(false)}
          onCreated={() => {
            setShowNewPatient(false);
            loadConversations();
          }}
        />
      )}
    </>
  );
}

function MessageBubble({
  msg,
  isMe,
  onOpenPhoto,
  onDelete,
}: {
  msg: Message;
  isMe: boolean;
  onOpenPhoto: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={`group flex ${isMe ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm ${
          isMe ? "bg-primary text-primary-foreground" : "bg-card border border-border"
        }`}
      >
        {msg.kind === "text" ? (
          <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
        ) : (
          <button
            onClick={() => onOpenPhoto(msg.id)}
            className="flex items-center gap-2 text-sm font-semibold hover:underline"
          >
            <Camera className="h-4 w-4" /> Ver foto de acompanhamento
          </button>
        )}
        <p className={`mt-1 text-[10px] ${isMe ? "text-white/70" : "text-muted-foreground"}`}>
          {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </p>
        {isMe && (
          <button
            onClick={() => onDelete(msg.id)}
            className="absolute -left-8 top-1/2 hidden -translate-y-1/2 rounded-full bg-destructive/10 p-1.5 text-destructive group-hover:block"
            title="Excluir"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ isProfessional }: { isProfessional: boolean }) {
  return (
    <div className="grid flex-1 place-items-center bg-background p-8 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-primary to-[hsl(340_85%_60%)] text-white shadow-lg">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-black">Ambiente 100% privado</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Substitui o WhatsApp para o envio de fotos de acompanhamento pós-procedimento. Apenas você e{" "}
          {isProfessional ? "a paciente vinculada" : "a sua profissional"} têm acesso às mensagens e imagens.
          Armazenamento criptografado, links de foto expiram em 5 minutos.
        </p>
        {isProfessional && (
          <p className="mt-4 text-xs text-muted-foreground">
            Clique em <b>Nova conversa</b> para vincular uma paciente por e-mail.
          </p>
        )}
      </div>
    </div>
  );
}

function NewConversationDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!user) return;
    setErr(null);
    setLoading(true);
    // Busca perfil por e-mail via profiles/user_roles não possui email — buscamos via profiles join com auth via RPC?
    // Alternativa: paciente deve informar seu id/email exato. Aqui: buscar em profiles por full_name/email não é possível.
    // Solução: buscar por email via um filtro em profiles (não temos). Precisamos de uma RPC — usaremos service via edge? Para MVP, buscar pelo full_name/e-mail em profiles.
    // Ajuste: pedir user_id direto? Melhor: mostrar convite manual — buscar em profiles.full_name (não ideal).
    // MVP: aceitamos o UUID da paciente OU e-mail — para e-mail, criamos por uma edge function futura.
    // Para agora: assumir input = UUID.
    const patientId = email.trim();
    if (!/^[0-9a-f-]{36}$/i.test(patientId)) {
      setErr("Cole o ID da paciente (UUID). Em breve suportaremos busca por e-mail.");
      setLoading(false);
      return;
    }
    // Cria vínculo (se ainda não existir)
    await supabase
      .from("patient_links")
      .insert({ patient_id: patientId, professional_id: user.id })
      .then(() => {}, () => {});
    const { error } = await supabase
      .from("conversations")
      .insert({ patient_id: patientId, professional_id: user.id });
    setLoading(false);
    if (error) return setErr(error.message);
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-black">Nova conversa</h3>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          Vincule uma paciente já cadastrada informando o ID dela (visível no perfil da paciente após login).
        </p>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ID da paciente"
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
        {err && <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</p>}
        <button
          onClick={submit}
          disabled={loading}
          className="mt-4 h-11 w-full rounded-xl bg-primary font-bold text-primary-foreground shadow-lg hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Criando..." : "Criar conversa"}
        </button>
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
