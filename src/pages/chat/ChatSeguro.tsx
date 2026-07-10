import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Lock, Plus, RefreshCw, Search, Send, ShieldCheck, Trash2, X } from "lucide-react";
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
  other_name?: string;
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

export default function ChatSeguro() {
  const { user, roles } = useAuth();
  const { getConvKey, createConversationKey, shareConversationKey } = useCrypto();
  const isProfessional = roles.includes("professional") || roles.includes("admin");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [startingWithClinic, setStartingWithClinic] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadConversations = async () => {
    if (!user) return;
    const { data: convs } = await supabase
      .from("conversations")
      .select("id, patient_id, professional_id, updated_at, access_code")
      .order("updated_at", { ascending: false });
    if (!convs) return;
    const ids = new Set<string>();
    convs.forEach((c) => {
      ids.add(c.patient_id);
      ids.add(c.professional_id);
    });
    const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", Array.from(ids));
    const map: Record<string, string> = {};
    profs?.forEach((p) => (map[p.id] = p.full_name ?? "Usuária"));
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

  const rotateAccessCode = async (conversationId: string) => {
    const { data, error } = await supabase.rpc("rotate_conversation_access_code", {
      _conversation_id: conversationId,
    });
    if (error) throw error;
    const newCode = String(data);
    setConversations((current) =>
      current.map((c) => (c.id === conversationId ? { ...c, access_code: newCode } : c)),
    );
    setUnlocked((s) => {
      const n = new Set(s);
      n.delete(conversationId);
      return n;
    });
    return newCode;
  };


  // Descriptografa mensagens de texto no cliente
  const decryptMessage = async (m: Message, conversationId: string): Promise<Message> => {
    if (m.kind !== "text") return m;
    if (m._decrypted) return m;
    if (m.iv && m.ciphertext) {
      try {
        const key = await prepareConversationKey(conversationId);
        const plain = await decryptText(m.iv, m.ciphertext, key);
        return { ...m, _decrypted: plain };
      } catch {
        return { ...m, _decrypted: "🔒 Não foi possível descriptografar" };
      }
    }
    // Mensagem legada em texto puro
    return { ...m, _decrypted: m.body ?? "" };
  };

  const activeUnlocked = activeId ? unlocked.has(activeId) : false;

  useEffect(() => {
    if (!activeId || !activeUnlocked) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      const raw = (data as Message[]) ?? [];
      const decrypted = await Promise.all(raw.map((m) => decryptMessage(m, activeId)));
      if (!cancelled) setMessages(decrypted);
    })();
    const ch = supabase
      .channel(`msg-${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        async (payload) => {
          const dec = await decryptMessage(payload.new as Message, activeId);
          setMessages((m) => (m.some((x) => x.id === dec.id) ? m : [...m, dec]));
        },
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, activeUnlocked]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const active = useMemo(() => conversations.find((c) => c.id === activeId) ?? null, [conversations, activeId]);

  const prepareConversationKey = async (conversationId: string) => {
    const key = await getConvKey(conversationId);
    await shareConversationKey(conversationId, key);
    return key;
  };

  const sendText = async () => {
    if (!activeId || !text.trim() || !user) return;
    const body = text.trim();
    setText("");
    try {
      const key = await prepareConversationKey(activeId);
      const { iv, ciphertext } = await encryptText(body, key);
      const { error } = await supabase.from("messages").insert({
        conversation_id: activeId,
        sender_id: user.id,
        kind: "text",
        iv,
        ciphertext,
      });
      if (error) throw error;
    } catch (e) {
      alert("Falha ao enviar: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const unlockConversation = async () => {
    if (!active) return;
    try {
      const norm = (s: string) => s.trim().toUpperCase().replace(/O/g, "0").replace(/[IL]/g, "1");
      // Comparação tolerante a caracteres ambíguos (0/O, 1/I/L)
      if (norm(pwInput) === norm(active.access_code)) {
        await prepareConversationKey(active.id);
        setUnlocked((s) => {
          const n = new Set(s);
          n.add(active.id);
          return n;
        });
        setPwInput("");
        setPwError(null);
      } else {
        setPwError("Código incorreto neste aparelho");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Não foi possível validar o código";
      setPwError(
        message.includes("Sem chave")
          ? "A chave desta conversa ainda não foi sincronizada. Abra a conversa pela outra conta uma vez."
          : message,
      );
    }
  };


  const sendPhoto = async (file: File) => {
    if (!activeId || !user) return;
    if (file.size > 10 * 1024 * 1024) return alert("Foto acima de 10MB");
    setUploading(true);
    try {
      const key = await prepareConversationKey(activeId);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { iv, ciphertext } = await encryptBytes(bytes, key);
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const { data, error } = await supabase.functions.invoke("upload-photo", {
        body: {
          conversation_id: activeId,
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
    if (!msg.photo_path || !activeId) return;
    try {
      // Baixa o blob criptografado via URL assinada
      const { data, error } = await supabase.functions.invoke("signed-photo-url", {
        body: { message_id: msg.id },
      });
      if (error || !data?.url) throw new Error("Sem acesso à foto");
      const res = await fetch(data.url);
      if (!res.ok) throw new Error("Falha no download");
      const buf = new Uint8Array(await res.arrayBuffer());
      const iv = buf.slice(0, 12);
      const ct = buf.slice(12);
      const key = await prepareConversationKey(activeId);
      const plain = await decryptBytes(iv, ct, key);
      const blob = new Blob([new Uint8Array(plain)]);
      const url = URL.createObjectURL(blob);
      setLightbox(url);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      alert(
        "Não foi possível abrir a foto: " +
          (message.includes("Sem chave")
            ? "a chave desta conversa ainda não foi sincronizada para esta conta. Abra a conversa pela conta que enviou a foto uma vez e tente novamente."
            : message),
      );
    }
  };

  const deleteMessage = async (id: string) => {
    if (!confirm("Excluir esta mensagem?")) return;
    await supabase.from("messages").delete().eq("id", id);
  };

  const viewer = {
    name: (user?.user_metadata?.full_name as string) || profiles[user?.id ?? ""] || "Usuário",
    email: user?.email ?? "",
  };

  return (
    <>
      <LgpdConsent />
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-border bg-card px-6 py-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow">
            <Lock className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-black">Chat Seguro</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> E2E · AES-256-GCM · 2FA · conforme LGPD art. 11
            </p>
          </div>
          {roles.includes("admin") && (
            <a
              href="/chat-seguro/recuperacao"
              className="hidden items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-foreground/80 hover:bg-muted md:inline-flex"
              title="Recuperação administrativa via escrow"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Recuperação
            </a>
          )}
          {isProfessional ? (
            <button
              onClick={() => setShowNewPatient(true)}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Nova conversa
            </button>
          ) : (
            <button
              onClick={async () => {
                if (!user) return;
                setStartingWithClinic(true);
                try {
                  const { data: admins, error: aerr } = await supabase
                    .from("clinic_admins")
                    .select("user_id")
                    .limit(1);
                  if (aerr) throw aerr;
                  const adminId = admins?.[0]?.user_id;
                  if (!adminId) throw new Error("Nenhuma profissional disponível na clínica ainda.");
                  const { data: pubKey } = await supabase
                    .from("user_keys")
                    .select("user_id")
                    .eq("user_id", adminId)
                    .maybeSingle();
                  if (!pubKey) {
                    throw new Error("A profissional ainda não configurou o cofre. Tente novamente em instantes.");
                  }
                  const { data: existing } = await supabase
                    .from("conversations")
                    .select("id")
                    .eq("patient_id", user.id)
                    .eq("professional_id", adminId)
                    .maybeSingle();
                  let convId = existing?.id;
                  if (!convId) {
                    const { data: conv, error } = await supabase
                      .from("conversations")
                      .insert({ patient_id: user.id, professional_id: adminId })
                      .select()
                      .single();
                    if (error) throw error;
                    convId = conv.id;
                    await createConversationKey(convId, adminId);
                  }
                  await loadConversations();
                  setActiveId(convId);
                } catch (e) {
                  alert(e instanceof Error ? e.message : String(e));
                } finally {
                  setStartingWithClinic(false);
                }
              }}
              disabled={startingWithClinic}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow hover:opacity-90 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" /> {startingWithClinic ? "Abrindo..." : "Falar com a clínica"}
            </button>
          )}

        </div>

        <div className="flex min-h-0 flex-1">
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
                  {isProfessional
                    ? "Nenhuma paciente iniciou uma conversa ainda."
                    : "Toque em 'Falar com a clínica' para iniciar sua conversa criptografada."}
                </p>
              ) : (
                conversations.map((c) => {
                  const isUnlocked = unlocked.has(c.id);
                  const isRevealed = !!showPw[c.id];
                  const code = c.access_code ?? "------";
                  return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setActiveId(c.id);
                      setPwInput("");
                      setPwError(null);
                    }}
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
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-bold">{c.other_name}</p>
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowPw((s) => ({ ...s, [c.id]: !s[c.id] }));
                          }}
                          role="button"
                          title={isRevealed ? "Ocultar senha do chat" : "Mostrar senha do chat"}
                          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider ${
                            activeId === c.id
                              ? "border-white/40 bg-white/15 text-white"
                              : "border-border bg-muted text-foreground"
                          }`}
                        >
                          <Lock className="h-3 w-3" />
                          {isRevealed ? code : "••••••"}
                        </span>
                        {isUnlocked && <ShieldCheck className="h-3 w-3 opacity-70" />}
                      </div>
                      <p className="truncate text-xs opacity-70">
                        {new Date(c.updated_at).toLocaleDateString("pt-BR")} · código próprio da conversa
                      </p>
                    </div>
                  </button>
                  );
                })
              )}
            </div>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col">
            {!active ? (
              <EmptyState isProfessional={isProfessional} />
            ) : !unlocked.has(active.id) ? (
              <div className="flex flex-1 items-center justify-center bg-background p-8">
                <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-xl">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow">
                      <Lock className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black">Conversa bloqueada</h3>
                      <p className="text-xs text-muted-foreground">
                        Digite o código de 6 caracteres desta conversa para abrir o conteúdo neste aparelho.
                      </p>
                    </div>
                  </div>
                  <input
                    autoFocus
                    value={pwInput}
                    onChange={(e) => { setPwInput(e.target.value); setPwError(null); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        unlockConversation();
                      }
                    }}
                    placeholder="Código da conversa (6 caracteres)"
                    maxLength={6}
                    className="h-11 w-full rounded-xl border border-border bg-background px-3 font-mono text-sm tracking-widest uppercase outline-none focus:border-primary"
                  />
                  {pwError && (
                    <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{pwError}</p>
                  )}
                  <button
                    onClick={unlockConversation}
                    className="mt-3 h-11 w-full rounded-xl bg-primary font-bold text-primary-foreground shadow hover:opacity-90 disabled:opacity-60"
                  >
                    Desbloquear conversa
                  </button>
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    O código é único desta conversa. Qualquer participante pode renovar a qualquer momento, o que invalida o código atual em todos os aparelhos.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 border-b border-border bg-card px-6 py-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary">
                    {(active.other_name ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold">{active.other_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Código: <span className="font-mono font-bold">{active.access_code}</span> · válido em qualquer aparelho até ser renovado
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm("Gerar um novo código? O atual deixará de funcionar em todos os aparelhos.")) return;
                      try {
                        const code = await rotateAccessCode(active.id);
                        alert(`Novo código: ${code}\n\nCompartilhe com segurança com ${active.other_name}.`);
                      } catch (e) {
                        alert("Falha ao renovar: " + (e instanceof Error ? e.message : String(e)));
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-bold hover:bg-muted"
                    title="Gerar um novo código de acesso"
                  >
                    <RefreshCw className="h-3 w-3" /> Renovar código
                  </button>
                  <button
                    onClick={() => setUnlocked((s) => { const n = new Set(s); n.delete(active.id); return n; })}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-bold hover:bg-muted"
                    title="Bloquear conversa novamente"
                  >
                    <Lock className="h-3 w-3" /> Bloquear
                  </button>
                </div>

                <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-background px-6 py-4">
                  {messages.map((m) => (
                    <MessageBubble
                      key={m.id}
                      msg={m}
                      isMe={m.sender_id === user?.id}
                      onOpenPhoto={() => openPhoto(m)}
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
                  {uploading && (
                    <p className="mt-2 text-xs text-muted-foreground">Criptografando e enviando foto…</p>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {lightbox && (
        <WatermarkedImage
          src={lightbox}
          viewer={viewer}
          onClose={() => {
            URL.revokeObjectURL(lightbox);
            setLightbox(null);
          }}
        />
      )}

      {showNewPatient && (
        <NewConversationDialog
          onClose={() => setShowNewPatient(false)}
          onCreated={() => {
            setShowNewPatient(false);
            loadConversations();
          }}
          createKey={createConversationKey}
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
  onOpenPhoto: () => void;
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
          <p className="text-sm whitespace-pre-wrap break-words">{msg._decrypted ?? "…"}</p>
        ) : (
          <button
            onClick={onOpenPhoto}
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
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-primary text-primary-foreground shadow-lg">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-black">Ambiente ponta-a-ponta</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          As fotos são criptografadas no seu navegador antes de sair do dispositivo. Só{" "}
          {isProfessional ? "você e a paciente vinculada" : "você e a sua profissional"} conseguem abrir. A senha do
          cofre nunca sai daqui.
        </p>
        {isProfessional && (
          <p className="mt-4 text-xs text-muted-foreground">
            Clique em <b>Nova conversa</b> para vincular uma paciente pelo ID.
          </p>
        )}
      </div>
    </div>
  );
}

function NewConversationDialog({
  onClose,
  onCreated,
  createKey,
}: {
  onClose: () => void;
  onCreated: () => void;
  createKey: (conversationId: string, otherUserId: string) => Promise<CryptoKey>;
}) {
  const { user } = useAuth();
  const [patientId, setPatientId] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!user) return;
    setErr(null);
    setLoading(true);
    const id = patientId.trim();
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      setErr("Cole o ID da paciente (UUID).");
      setLoading(false);
      return;
    }
    try {
      // valida se paciente tem chave pública (necessário pra E2E)
      const { data: pubKey } = await supabase.from("user_keys").select("user_id").eq("user_id", id).maybeSingle();
      if (!pubKey) {
        throw new Error(
          "Esta paciente ainda não criou o cofre de fotos. Peça pra ela entrar uma vez na plataforma antes.",
        );
      }
      await supabase
        .from("patient_links")
        .insert({ patient_id: id, professional_id: user.id })
        .then(
          () => {},
          () => {},
        );
      const { data: conv, error } = await supabase
        .from("conversations")
        .insert({ patient_id: id, professional_id: user.id })
        .select()
        .single();
      if (error) throw error;
      await createKey(conv.id, id);
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
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
          Cole o ID (UUID) da paciente. Ela precisa já ter feito login e criado o cofre pelo menos uma vez.
        </p>
        <input
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          placeholder="ID da paciente"
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
        {err && <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</p>}
        <button
          onClick={submit}
          disabled={loading}
          className="mt-4 h-11 w-full rounded-xl bg-primary font-bold text-primary-foreground shadow-lg hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Criando..." : "Criar conversa criptografada"}
        </button>
      </div>
    </div>
  );
}
