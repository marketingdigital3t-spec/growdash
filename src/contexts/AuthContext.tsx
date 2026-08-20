import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withRequestTimeout } from "@/lib/resilience";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  status: "hydrating" | "authenticated" | "unauthenticated" | "unavailable";
  retrySession: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  status: "hydrating",
  retrySession: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthContextType["status"]>("hydrating");
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    // Nunca trate um timeout de rede como logout. Isso era a origem de telas de
    // login indevidas quando o token ainda estava sendo hidratado pelo Supabase.
    const timeout = window.setTimeout(() => {
      if (active) setStatus((current) => current === "hydrating" ? "unavailable" : current);
    }, 10_000);

    const applySession = (nextSession: Session | null) => {
      if (!active) return;
      const nextUserId = nextSession?.user.id ?? null;
      if (userIdRef.current !== null && userIdRef.current !== nextUserId) queryClient.clear();
      userIdRef.current = nextUserId;
      setSession(nextSession);
      setStatus(nextSession ? "authenticated" : "unauthenticated");
      window.clearTimeout(timeout);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        // Queries are intentionally shared by feature keys for fast navigation,
        // so clear them when the account changes to prevent a prior user's data
        // from flashing while the new session is loading.
        if (event === "SIGNED_OUT") queryClient.clear();
        applySession(nextSession);
      }
    );

    void supabase.auth.getSession().then(({ data: { session } }) => applySession(session)).catch(() => {
      if (active) setStatus("unavailable");
      window.clearTimeout(timeout);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, [queryClient]);

  const retrySession = async () => {
    setStatus("hydrating");
    try {
      // A manual retry must have the same bounded behavior as the initial
      // boot. Without this timeout a flaky Supabase connection could return
      // the entire platform to an infinite loading state.
      const { data } = await withRequestTimeout(supabase.auth.getSession(), 10_000);
      setSession(data.session);
      setStatus(data.session ? "authenticated" : "unauthenticated");
    } catch {
      setStatus("unavailable");
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading: status === "hydrating", status, retrySession, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
