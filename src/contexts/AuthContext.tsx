import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { getPersistedAuthSession, supabase } from "@/integrations/supabase/client";
import { withRequestTimeout } from "@/lib/resilience";
import { AUTH_SESSION_TIMEOUT_MS, authSessionErrorMessage, type AccessBootstrapSnapshot } from "@/lib/authAvailability";

const SESSION_CHECK_TIMEOUT_MS = AUTH_SESSION_TIMEOUT_MS;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  status: "hydrating" | "authenticated" | "degraded" | "unauthenticated" | "unavailable";
  errorMessage: string | null;
  retrySession: () => Promise<void>;
  signOut: () => Promise<void>;
  bootstrap: AccessBootstrapSnapshot;
  setBootstrapStep: (step: AccessBootstrapSnapshot["step"]) => void;
}

function createBootstrapSnapshot(attempt = 0): AccessBootstrapSnapshot {
  const now = new Date().toISOString();
  return { status: "hydrating", step: "session", startedAt: now, updatedAt: now, errorCode: null, errorMessage: null, retryAvailable: true, attempt };
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  status: "hydrating",
  errorMessage: null,
  retrySession: async () => {},
  signOut: async () => {},
  bootstrap: createBootstrapSnapshot(),
  setBootstrapStep: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthContextType["status"]>("hydrating");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bootstrap, setBootstrap] = useState<AccessBootstrapSnapshot>(() => createBootstrapSnapshot());
  const attemptRef = useRef(0);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    let timeout: number | undefined;
    // Nunca trate um timeout de rede como logout. Isso era a origem de telas de
    // login indevidas quando o token ainda estava sendo hidratado pelo Supabase.
    const applySession = (nextSession: Session | null, degraded = false) => {
      if (!active) return;
      const nextUserId = nextSession?.user.id ?? null;
      // Clear even on the first resolved user: a startup cache can precede
      // authentication and must never appear in the authenticated workspace.
      if (userIdRef.current !== nextUserId) queryClient.clear();
      userIdRef.current = nextUserId;
      setSession(nextSession);
      setStatus(nextSession ? (degraded ? "degraded" : "authenticated") : "unauthenticated");
      const message = degraded ? authSessionErrorMessage(new Error("timeout")) : null;
      setErrorMessage(message);
      setBootstrap((current) => ({ ...current, status: "ready", step: "session", updatedAt: new Date().toISOString(), errorCode: degraded ? "AUTH_SESSION_REVALIDATING" : null, errorMessage: message, retryAvailable: true }));
      if (timeout !== undefined) window.clearTimeout(timeout);
    };

    const recoverFromStorage = () => {
      const cachedSession = getPersistedAuthSession();
      if (!cachedSession) return false;
      applySession(cachedSession, true);
      return true;
    };

    timeout = window.setTimeout(() => {
      if (active && !recoverFromStorage()) {
        setStatus((current) => current === "hydrating" ? "unavailable" : current);
        setBootstrap((current) => current.status === "hydrating" ? { ...current, status: "unavailable", updatedAt: new Date().toISOString(), errorCode: "AUTH_SESSION_TIMEOUT", errorMessage: authSessionErrorMessage(new Error("timeout")), retryAvailable: true } : current);
      }
    }, SESSION_CHECK_TIMEOUT_MS);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        // Queries are intentionally shared by feature keys for fast navigation,
        // so clear them when the account changes to prevent a prior user's data
        // from flashing while the new session is loading.
        if (event === "SIGNED_OUT") queryClient.clear();
        applySession(nextSession);
      }
    );

    void withRequestTimeout(supabase.auth.getSession(), SESSION_CHECK_TIMEOUT_MS).then(({ data: { session } }) => applySession(session)).catch((error) => {
      if (active) {
        const cachedSession = getPersistedAuthSession();
        if (cachedSession) {
          applySession(cachedSession, true);
        } else {
          setStatus("unavailable");
          const message = authSessionErrorMessage(error);
          setErrorMessage(message);
          setBootstrap((current) => ({ ...current, status: "unavailable", updatedAt: new Date().toISOString(), errorCode: "AUTH_SESSION_UNAVAILABLE", errorMessage: message, retryAvailable: true }));
        }
      }
      if (timeout !== undefined) window.clearTimeout(timeout);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [queryClient]);

  const retrySession = async () => {
    attemptRef.current += 1;
    const cachedSession = getPersistedAuthSession();
    if (!cachedSession) setStatus("hydrating");
    setErrorMessage(null);
    setBootstrap({ ...createBootstrapSnapshot(attemptRef.current), startedAt: new Date().toISOString() });
    try {
      // A manual retry must have the same bounded behavior as the initial
      // boot. Without this timeout a flaky Supabase connection could return
      // the entire platform to an infinite loading state.
      const { data } = await withRequestTimeout(supabase.auth.getSession(), SESSION_CHECK_TIMEOUT_MS);
      const nextUserId = data.session?.user.id ?? null;
      if (userIdRef.current !== nextUserId) queryClient.clear();
      userIdRef.current = nextUserId;
      setSession(data.session);
      setStatus(data.session ? "authenticated" : "unauthenticated");
      setErrorMessage(null);
      setBootstrap((current) => ({ ...current, status: "ready", updatedAt: new Date().toISOString(), errorCode: null, errorMessage: null }));
    } catch (error) {
      const fallbackSession = cachedSession || getPersistedAuthSession();
      if (fallbackSession) {
        setSession(fallbackSession);
        setStatus("degraded");
        const message = authSessionErrorMessage(error);
        setErrorMessage(message);
        setBootstrap((current) => ({ ...current, status: "ready", updatedAt: new Date().toISOString(), errorCode: "AUTH_SESSION_REVALIDATING", errorMessage: message, retryAvailable: true }));
      } else {
        setStatus("unavailable");
        const message = authSessionErrorMessage(error);
        setErrorMessage(message);
        setBootstrap((current) => ({ ...current, status: "unavailable", updatedAt: new Date().toISOString(), errorCode: "AUTH_SESSION_UNAVAILABLE", errorMessage: message, retryAvailable: true }));
      }
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const setBootstrapStep = (step: AccessBootstrapSnapshot["step"]) => {
    setBootstrap((current) => ({ ...current, step, updatedAt: new Date().toISOString() }));
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading: status === "hydrating", status, errorMessage, retrySession, signOut, bootstrap, setBootstrapStep }}>
      {children}
    </AuthContext.Provider>
  );
}
