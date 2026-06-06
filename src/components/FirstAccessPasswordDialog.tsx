import { useEffect, useMemo, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

function firstAccessKey(userId?: string) {
  return userId ? `trackvio:first-access-required:${userId}` : "";
}

export function FirstAccessPasswordDialog() {
  const { user } = useAuth();
  const { toast } = useToast();
  const storageKey = firstAccessKey(user?.id);
  const required = useMemo(() => {
    if (!storageKey) return false;
    try {
      return localStorage.getItem(storageKey) === "true";
    } catch {
      return false;
    }
  }, [storageKey]);
  const [open, setOpen] = useState(required);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setOpen(required);
  }, [required]);

  const save = async () => {
    if (password.length < 8) {
      toast({ title: "Senha muito curta", description: "Use pelo menos 8 caracteres.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Senhas diferentes", description: "Confirme a mesma senha nos dois campos.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao trocar senha", description: error.message, variant: "destructive" });
      return;
    }
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    setOpen(false);
    toast({ title: "Senha atualizada", description: "A partir de agora essa será a senha definitiva do usuário." });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => setOpen(required ? true : next)}>
      <DialogContent className="border-primary/20 bg-card/95 backdrop-blur-xl sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
            <KeyRound className="h-5 w-5" />
          </div>
          <DialogTitle>Defina sua nova senha</DialogTitle>
          <DialogDescription>
            Este é o primeiro acesso. Troque a senha temporária antes de continuar usando a Trackvio.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="first-access-password">Nova senha</Label>
            <Input
              id="first-access-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mínimo de 8 caracteres"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="first-access-confirm">Confirmar nova senha</Label>
            <Input
              id="first-access-confirm"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repita a senha"
            />
          </div>
          <Button className="w-full gap-2" onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar nova senha
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
