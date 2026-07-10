import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import * as C from "@/lib/crypto";

type CryptoCtx = {
  unlocked: boolean;
  needsSetup: boolean;
  hasKeypair: boolean;
  loading: boolean;
  unlock: (password: string) => Promise<void>;
  setup: (password: string) => Promise<void>;
  resetVault: (password: string) => Promise<void>;
  lock: () => void;
  getConvKey: (conversationId: string) => Promise<CryptoKey>;
  createConversationKey: (conversationId: string, otherUserId: string) => Promise<CryptoKey>;
};

const Ctx = createContext<CryptoCtx | null>(null);

export function CryptoProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [hasKeypair, setHasKeypair] = useState(false);
  const [loading, setLoading] = useState(false);
  const convCache = useRef<Map<string, CryptoKey>>(new Map());

  useEffect(() => {
    if (!user) {
      setPrivateKey(null);
      setHasKeypair(false);
      convCache.current.clear();
      return;
    }
    setLoading(true);
    (async () => {
      const { data } = await supabase.from("user_keys").select("user_id").eq("user_id", user.id).maybeSingle();
      const has = !!data;
      setHasKeypair(has);
      setLoading(false);
      // Auto-unlock/setup usando a senha de login guardada em sessionStorage
      const pw = sessionStorage.getItem("vault_pw");
      if (pw) {
        try {
          if (has) await unlockInternal(pw);
          else await setupInternal(pw);
        } catch {
          /* usuário poderá digitar manualmente no VaultGate */
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const setupInternal = async (password: string) => {
    if (!user) throw new Error("Sessão inválida");
    if (password.length < 8) throw new Error("Senha precisa ter no mínimo 8 caracteres");
    const kp = await C.generateKeypair();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const iterations = 600_000;
    const wrap = await C.deriveWrapKey(password, salt, iterations);
    const encrypted_private_key = await C.wrapPrivateKeyWithPassword(kp.privateKey, wrap, iv);
    const publicJwk = await C.exportPublicJwk(kp.publicKey);
    const { error: e1 } = await supabase
      .from("user_keys")
      .upsert({ user_id: user.id, public_key: publicJwk as unknown as never });
    if (e1) throw e1;
    const { error: e2 } = await supabase.from("user_private_keys").upsert({
      user_id: user.id,
      encrypted_private_key,
      salt: C.b64.encode(salt),
      iv: C.b64.encode(iv),
      iterations,
    });
    if (e2) throw e2;
    await supabase.from("security_events").insert({
      user_id: user.id,
      event_type: "e2e_key_created",
      user_agent: navigator.userAgent,
    });
    setPrivateKey(kp.privateKey);
    setHasKeypair(true);
  };

  const unlockInternal = async (password: string) => {
    if (!user) throw new Error("Sessão inválida");
    const { data, error } = await supabase
      .from("user_private_keys")
      .select("encrypted_private_key, salt, iv, iterations")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error || !data) throw new Error("Cofre não encontrado");
    const salt = C.b64.decode(data.salt);
    const iv = C.b64.decode(data.iv);
    const wrap = await C.deriveWrapKey(password, salt, data.iterations);
    const priv = await C.unwrapPrivateKeyWithPassword(data.encrypted_private_key, wrap, iv);
    setPrivateKey(priv);
    await supabase.from("security_events").insert({
      user_id: user.id,
      event_type: "vault_unlocked",
      user_agent: navigator.userAgent,
    });
  };


  const setup = async (password: string) => {
    await setupInternal(password);
    sessionStorage.setItem("vault_pw", password);
  };

  const unlock = async (password: string) => {
    try {
      await unlockInternal(password);
      sessionStorage.setItem("vault_pw", password);
    } catch {
      await supabase.from("security_events").insert({
        user_id: user!.id,
        event_type: "vault_unlock_failed",
        user_agent: navigator.userAgent,
      });
      throw new Error("Senha do cofre incorreta");
    }
  };

  // Recria o cofre do zero (novo par de chaves) usando a senha informada.
  // Perde acesso a chaves de conversa antigas — usada quando o usuário esqueceu
  // a senha antiga ou quer sincronizar o cofre com a senha de login atual.
  const resetVault = async (password: string) => {
    if (!user) throw new Error("Sessão inválida");
    // Remove chaves de conversa antigas (o novo par não conseguiria abri-las)
    await supabase.from("conversation_keys").delete().eq("recipient_id", user.id);
    // Zera qualquer chave privada antiga antes de recriar
    await supabase.from("user_private_keys").delete().eq("user_id", user.id);
    await supabase.from("user_keys").delete().eq("user_id", user.id);
    setHasKeypair(false);
    setPrivateKey(null);
    convCache.current.clear();
    await setupInternal(password);
    sessionStorage.setItem("vault_pw", password);
    await supabase.from("security_events").insert({
      user_id: user.id,
      event_type: "vault_reset",
      user_agent: navigator.userAgent,
    });
  };

  const lock = () => {
    setPrivateKey(null);
    convCache.current.clear();
  };

  const getConvKey = async (conversationId: string) => {
    if (!user) throw new Error("Sessão inválida");
    if (!privateKey) throw new Error("Cofre bloqueado — digite sua senha do cofre");
    const cached = convCache.current.get(conversationId);
    if (cached) return cached;
    const fetchWrapped = async () =>
      supabase
        .from("conversation_keys")
        .select("wrapped_key")
        .eq("conversation_id", conversationId)
        .eq("recipient_id", user.id)
        .maybeSingle();

    let { data, error } = await fetchWrapped();
    if (!data && !error) {
      // Auto-heal: conversa criada antes do cofre existir. Só é seguro
      // regenerar a chave enquanto ainda não há mensagens cifradas.
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conversationId);
      if ((count ?? 0) === 0) {
        const { data: conv } = await supabase
          .from("conversations")
          .select("patient_id, professional_id")
          .eq("id", conversationId)
          .maybeSingle();
        if (conv) {
          const other = conv.patient_id === user.id ? conv.professional_id : conv.patient_id;
          // limpa possíveis linhas antigas parciais e cria de novo
          await supabase
            .from("conversation_keys")
            .delete()
            .eq("conversation_id", conversationId);
          convCache.current.delete(conversationId);
          const aes = await createConversationKey(conversationId, other);
          return aes;
        }
      }
    }
    if (error || !data) throw new Error("Sem chave para esta conversa");
    const key = await C.unwrapConversationKey(data.wrapped_key, privateKey);
    convCache.current.set(conversationId, key);
    return key;
  };


  const createConversationKey = async (conversationId: string, otherUserId: string) => {
    if (!user) throw new Error("Sessão inválida");
    const aes = await C.generateConversationKey();
    const { data: admins } = await supabase.from("clinic_admins").select("user_id");
    const targets = Array.from(new Set<string>([user.id, otherUserId, ...(admins?.map((a) => a.user_id) ?? [])]));
    const { data: keys } = await supabase
      .from("user_keys")
      .select("user_id, public_key")
      .in("user_id", targets);
    const rows: Array<{
      conversation_id: string;
      recipient_id: string;
      wrapped_key: string;
      is_admin_escrow: boolean;
    }> = [];
    for (const k of keys ?? []) {
      const pub = await C.importPublicJwk(k.public_key as unknown as JsonWebKey);
      rows.push({
        conversation_id: conversationId,
        recipient_id: k.user_id,
        wrapped_key: await C.wrapConversationKey(aes, pub),
        is_admin_escrow: k.user_id !== user.id && k.user_id !== otherUserId,
      });
    }
    const missing = targets.filter((id) => !(keys ?? []).some((k) => k.user_id === id));
    if (missing.length) {
      await supabase.from("security_events").insert({
        user_id: user.id,
        event_type: "conversation_key_pending",
        metadata: { conversation_id: conversationId, missing_users: missing } as unknown as never,
      });
    }
    if (rows.length) {
      const { error } = await supabase.from("conversation_keys").insert(rows);
      if (error) throw error;
    }
    convCache.current.set(conversationId, aes);
    return aes;
  };

  return (
    <Ctx.Provider
      value={{
        unlocked: !!privateKey,
        needsSetup: !!user && !hasKeypair && !loading,
        hasKeypair,
        loading,
        unlock,
        setup,
        resetVault,
        lock,
        getConvKey,
        createConversationKey,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useCrypto() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCrypto must be used within CryptoProvider");
  return v;
}
