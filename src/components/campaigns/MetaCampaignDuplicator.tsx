import { useEffect, useState } from "react";
import { AlertTriangle, Copy, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { edgeFunctionErrorDetails, formatEdgeFunctionError } from "@/lib/edgeFunctionError";

type Campaign = { id: string; name: string; status?: string | null };

type Props = {
  campaign: Campaign | null;
  onOpenChange: (open: boolean) => void;
  onDuplicated: (campaign: { id: string; name: string; status: string }) => void | Promise<void>;
};

export function MetaCampaignDuplicator({ campaign, onOpenChange, onDuplicated }: Props) {
  const [name, setName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(campaign ? `${campaign.name} — Cópia` : "");
    setConfirmed(false);
  }, [campaign]);

  const submit = async () => {
    if (!campaign || !name.trim() || !confirmed) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-manage-entity", {
        body: { operation: "duplicate_campaign", campaignId: campaign.id, name: name.trim() },
      });
      if (error) throw new Error(formatEdgeFunctionError(await edgeFunctionErrorDetails(error)));
      if (data?.error || !data?.campaignId) throw new Error(data?.error || "A Meta não retornou a campanha duplicada.");
      await onDuplicated({ id: String(data.campaignId), name: String(data.name || name.trim()), status: String(data.status || "PAUSED") });
      toast.success("Campanha duplicada e aberta para edição.");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível duplicar a campanha.");
    } finally {
      setSaving(false);
    }
  };

  return <Dialog open={!!campaign} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Duplicar campanha</DialogTitle>
        <DialogDescription>A cópia inclui a estrutura da campanha e será criada pausada, sem iniciar gastos.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200"><div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>Revise público, orçamento, criativos e rastreamento antes de ativar a nova campanha.</span></div></div>
        <div className="space-y-2"><Label htmlFor="duplicate-meta-campaign-name">Nome da nova campanha</Label><Input id="duplicate-meta-campaign-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={255} /></div>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-xs"><Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(value === true)} /><span>Confirmo que quero criar uma cópia pausada e abrir a nova campanha para revisão.</span></label>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><ShieldCheck className="h-4 w-4 text-emerald-600" />A alteração é processada no backend e registrada no histórico.</div>
      </div>
      <DialogFooter><Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={!name.trim() || !confirmed || saving} onClick={submit}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}Duplicar pausada</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
