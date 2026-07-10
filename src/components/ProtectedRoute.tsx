import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth, type AppRole } from "@/hooks/useAuth";

type Props = {
  children: ReactNode;
  /** Se definido, apenas usuários com esses papéis podem acessar. */
  allow?: AppRole[];
  /** Se definido e o usuário NÃO tiver os papéis permitidos, redireciona para cá. */
  fallback?: string;
};

export default function ProtectedRoute({ children, allow, fallback = "/" }: Props) {
  const { user, roles, loading } = useAuth();
  const loc = useLocation();
  if (loading) {
    return (
      <div className="grid h-screen place-items-center text-muted-foreground text-sm">Carregando...</div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (allow && !allow.some((r) => roles.includes(r))) {
    return <Navigate to={fallback} replace />;
  }
  return <>{children}</>;
}
