import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { edgeFunctionErrorDetails, formatEdgeFunctionError } from "@/lib/edgeFunctionError";

export type EditableMetaEntity = {
  type: "campaign" | "adset" | "ad";
  id: string;
  name: string;
  status: string | null;
  dailyBudget?: number | null;
};

type Props = {
  entity: EditableMetaEntity | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void | Promise<void>;
};

const labels = {
  campaign: "campanha",
  adset: "conjunto de anúncios",
  ad: "anúncio",
};

export function MetaEntityEditor({ entity, onOpenChange, onSaved }: Props) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState("PAUSED");
  const [dailyBudget, setDailyBudget] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(entity?.name ?? "");
    setStatus(entity?.status === "ACTIVE" ? "ACTIVE" : "PAUSED");
    setDailyBudget(entity?.dailyBudget != null ? String(entity.dailyBudget) : "");
    setConfirmed(false);
  }, [entity]);

  const submit = async () => {
    if (!entity || !confirmed || !name.trim()) return;
    const changes: Record<string, string | number> = {
      name: name.trim(),
      status,
    };

    if (entity.type === "adset") {
      const normalizedBudget = Number(dailyBudget.replace(",", "."));
      if (!Number.isFinite(normalizedBudget) || normalizedBudget <= 0) {
        toast.error("Informe um orçamento diário válido.");
        return;
      }
      changes.dailyBudget = normalizedBudget;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-manage-entity", {
        body: { entityType: entity.type, entityId: entity.id, changes },
      });
      if (error) throw new Error(formatEdgeFunctionError(await edgeFunctionErrorDetails(error)));
      if (data?.error) throw new Error(data.error);
      toast.success(`${labels[entity.type]} atualizada na Meta Ads.`);
      await onSaved();
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível concluir a alteração.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!entity} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar {entity ? labels[entity.type] : "item"}</DialogTitle>
          <DialogDescription>
            A alteração será enviada para a Meta Ads e registrada no histórico da Growdash.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-3 text-xs text-amber-900">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Ativar, pausar ou alterar orçamento afeta a veiculação e o gasto real da conta.</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta-entity-name">Nome</Label>
            <Input id="meta-entity-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={255} />
          </div>

          <div className="space-y-2">
            <Label>Status de veiculação</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Ativa</SelectItem>
                <SelectItem value="PAUSED">Pausada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {entity?.type === "adset" && (
            <div className="space-y-2">
              <Label htmlFor="meta-daily-budget">Orçamento diário (R$)</Label>
              <Input
                id="meta-daily-budget"
                inputMode="decimal"
                value={dailyBudget}
                onChange={(event) => setDailyBudget(event.target.value)}
                placeholder="100,00"
              />
            </div>
          )}

          {entity?.type === "campaign" && (
            <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              O orçamento desta estrutura está nos conjuntos. Selecione a campanha e abra a aba
              <strong> Conjuntos</strong> para editar o valor diário.
            </p>
          )}

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-xs">
            <Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(value === true)} />
            <span>Confirmo que revisei o nome, o status e o orçamento e autorizo o envio desta alteração à Meta Ads.</span>
          </label>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Token processado somente no backend; nenhuma credencial é enviada ao navegador.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={!confirmed || !name.trim() || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Aplicar na Meta Ads
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
