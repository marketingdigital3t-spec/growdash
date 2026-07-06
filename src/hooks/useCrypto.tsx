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
      setHasKeypair(!!data);
      setLoading(false);
    })();
  }, [user]);

  const setup = async (password: string) => {
    if (!user) throw new Error("Sessão inválida");
    if (password.length < 10) throw new Error("Senha do cofre precisa ter no mínimo 10 caracteres");
    const kp = await C.generateKeypair();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const iterations = 600_000;
    const wrap = await C.deriveWrapKey(password, salt, iterations);
    const encrypted_private_key = await C.wrapPrivateKeyWithPassword(kp.privateKey, wrap, iv);
    const publicJwk = await C.exportPublicJwk(kp.publicKey);

    const { error: e1 } = await supabase
      .from("user_keys")
      .upsert({ user_id: user.id, public_key: publicJwk as unknown as object });
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

  const unlock = async (password: string) => {
    if (!user) throw new Error("Sessão inválida");
    const { data, error } = await supabase
      .from("user_private_keys")
      .select("encrypted_private_key, salt, iv, iterations")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error || !data) throw new Error("Cofre não encontrado");
    try {
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
    } catch {
      await supabase.from("security_events").insert({
        user_id: user.id,
        event_type: "vault_unlock_failed",
        user_agent: navigator.userAgent,
      });
      throw new Error("Senha do cofre incorreta");
    }
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
    const { data, error } = await supabase
      .from("conversation_keys")
      .select("wrapped_key")
      .eq("conversation_id", conversationId)
      .eq("recipient_id", user.id)
      .maybeSingle();
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
        metadata: { conversation_id: conversationId, missing_users: missing } as unknown as object,
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
