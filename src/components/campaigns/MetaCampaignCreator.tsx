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

type AccountOption = { id: string; name: string };

type Props = {
  open: boolean;
  accounts: AccountOption[];
  defaultAccountId?: string;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void | Promise<void>;
};

const objectives = [
  ["OUTCOME_AWARENESS", "Reconhecimento"],
  ["OUTCOME_TRAFFIC", "Tráfego"],
  ["OUTCOME_ENGAGEMENT", "Engajamento"],
  ["OUTCOME_LEADS", "Leads"],
  ["OUTCOME_APP_PROMOTION", "Promoção do app"],
  ["OUTCOME_SALES", "Vendas"],
] as const;

export function MetaCampaignCreator({ open, accounts, defaultAccountId, onOpenChange, onCreated }: Props) {
  const [accountId, setAccountId] = useState("");
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("OUTCOME_LEADS");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const preferred = defaultAccountId && accounts.some((account) => account.id === defaultAccountId)
      ? defaultAccountId
      : accounts.length === 1 ? accounts[0].id : "";
    setAccountId(preferred);
    setName("");
    setObjective("OUTCOME_LEADS");
    setConfirmed(false);
  }, [accounts, defaultAccountId, open]);

  const submit = async () => {
    if (!accountId || !name.trim() || !confirmed) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-manage-entity", {
        body: {
          operation: "create_campaign",
          accountId,
          campaign: { name: name.trim(), objective },
        },
      });
      if (error) throw new Error(formatEdgeFunctionError(await edgeFunctionErrorDetails(error)));
      if (data?.error) throw new Error(data.error);
      toast.success("Campanha criada como pausada na Meta Ads.");
      await onCreated();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a campanha.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Criar campanha</DialogTitle>
          <DialogDescription>A campanha será criada pausada. Nada será publicado ou começará a gastar automaticamente.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
            <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>Depois da criação, configure conjunto, público, posicionamento, criativo e rastreamento antes de ativar.</span></div>
          </div>

          <div className="space-y-2">
            <Label>Conta de anúncio</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Selecione uma conta" /></SelectTrigger>
              <SelectContent>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-meta-campaign-name">Nome da campanha</Label>
            <Input id="new-meta-campaign-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={255} placeholder="Ex.: 18/07 | LEADS | FORMS | ABO" />
          </div>

          <div className="space-y-2">
            <Label>Objetivo</Label>
            <Select value={objective} onValueChange={setObjective}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{objectives.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-xs">
            <Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(value === true)} />
            <span>Confirmo a conta e o objetivo. Autorizo criar esta campanha na Meta com status pausado.</span>
          </label>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><ShieldCheck className="h-4 w-4 text-emerald-600" />O token permanece no backend e a ação fica registrada no histórico.</div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={!accountId || !name.trim() || !confirmed || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar campanha pausada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
