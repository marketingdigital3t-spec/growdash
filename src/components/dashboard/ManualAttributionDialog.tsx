import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useUpdateSale, type Sale } from "@/hooks/useSales";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface Props {
  sale: Sale | null;
  open: boolean;
  onClose: () => void;
}

type Option = { value: string; label: string; sublabel?: string };

export function ManualAttributionDialog({ sale, open, onClose }: Props) {
  const { data: accounts = [] } = useAdAccounts();
  const update = useUpdateSale();
  const { toast } = useToast();

  const [accountId, setAccountId] = useState<string>("");
  const [campaignId, setCampaignId] = useState<string>("");
  const [adsetId, setAdsetId] = useState<string>("");
  const [adId, setAdId] = useState<string>("");

  useEffect(() => {
    if (sale) {
      setAccountId(sale.ad_account_id ?? "");
      setCampaignId((sale as any).manual_campaign_id ?? "");
      setAdsetId((sale as any).manual_adset_id ?? "");
      setAdId((sale as any).manual_ad_id ?? "");
    }
  }, [sale]);

  // Campanhas filtradas pela conta selecionada
  const { data: allCampaigns = [] } = useQuery({
    queryKey: ["mattr-campaigns-by-account", accountId],
    enabled: !!accountId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, ad_account_id")
        .eq("ad_account_id", accountId)
        .order("name")
        .range(0, 4999);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: adsets = [] } = useQuery({
    queryKey: ["mattr-adsets", campaignId],
    enabled: !!campaignId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adsets").select("id, name").eq("campaign_id", campaignId).order("name").range(0, 4999);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: ads = [] } = useQuery({
    queryKey: ["mattr-ads", adsetId],
    enabled: !!adsetId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ads").select("id, name").eq("adset_id", adsetId).order("name").range(0, 4999);
      if (error) throw error;
      return data ?? [];
    },
  });

  const accountOptions: Option[] = useMemo(
    () => accounts.map((a) => ({ value: a.id, label: a.name })),
    [accounts],
  );

  const campaignOptions: Option[] = useMemo(
    () =>
      allCampaigns.map((c: any) => ({
        value: c.id,
        label: c.name,
      })),
    [allCampaigns],
  );

  const adsetOptions: Option[] = useMemo(
    () => adsets.map((a: any) => ({ value: a.id, label: a.name })),
    [adsets],
  );
  const adOptions: Option[] = useMemo(
    () => ads.map((a: any) => ({ value: a.id, label: a.name })),
    [ads],
  );

  const handleSelectCampaign = (v: string) => {
    setCampaignId(v);
    setAdsetId("");
    setAdId("");
  };

  const handleSave = async () => {
    if (!sale) return;
    try {
      await update.mutateAsync({
        id: sale.id,
        manual_campaign_id: campaignId || null,
        manual_adset_id: adsetId || null,
        manual_ad_id: adId || null,
        manual_override: !!(campaignId || adsetId || adId),
        ad_account_id: accountId || null,
      } as any);
      toast({ title: "Atribuição salva" });
      onClose();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleClear = async () => {
    if (!sale) return;
    await update.mutateAsync({
      id: sale.id,
      manual_campaign_id: null,
      manual_adset_id: null,
      manual_ad_id: null,
      manual_override: false,
    } as any);
    toast({ title: "Atribuição manual removida" });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atribuir venda manualmente</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <ComboField
            label="Conta de anúncios"
            value={accountId}
            onChange={(v) => { setAccountId(v); setCampaignId(""); setAdsetId(""); setAdId(""); }}
            options={accountOptions}
            placeholder="Selecione..."
            searchPlaceholder="Buscar conta..."
          />
          <ComboField
            label="Campanha"
            value={campaignId}
            onChange={handleSelectCampaign}
            options={campaignOptions}
            disabled={!accountId}
            placeholder={accountId ? "Selecione..." : "Selecione uma conta primeiro"}
            searchPlaceholder="Buscar campanha..."
          />
          <ComboField
            label="Conjunto (opcional)"
            value={adsetId}
            onChange={(v) => { setAdsetId(v); setAdId(""); }}
            options={adsetOptions}
            disabled={!campaignId}
            placeholder="—"
            searchPlaceholder="Buscar conjunto..."
          />
          <ComboField
            label="Criativo (opcional)"
            value={adId}
            onChange={setAdId}
            options={adOptions}
            disabled={!adsetId}
            placeholder="—"
            searchPlaceholder="Buscar criativo..."
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={handleClear}>Remover atribuição</Button>
          <Button onClick={handleSave} disabled={!campaignId || update.isPending}>
            {update.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ComboField({
  label, value, onChange, options, disabled, placeholder, searchPlaceholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            disabled={disabled}
            className="w-full justify-between h-9 text-xs font-normal"
          >
            <span className={cn("truncate", !selected && "text-muted-foreground")}>
              {selected ? selected.label : (disabled ? "—" : placeholder ?? "Selecione...")}
            </span>
            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[--radix-popover-trigger-width] min-w-[280px]"
          align="start"
        >
          <Command
            filter={(itemValue, search) => {
              const text = itemValue.toLowerCase();
              return text.includes(search.toLowerCase()) ? 1 : 0;
            }}
          >
            <CommandInput placeholder={searchPlaceholder ?? "Buscar..."} className="h-9" />
            <CommandList>
              <CommandEmpty>Nenhum resultado.</CommandEmpty>
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={`${o.label} ${o.sublabel ?? ""} ${o.value}`}
                    onSelect={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className="text-xs"
                  >
                    <Check
                      className={cn("mr-2 h-3 w-3", value === o.value ? "opacity-100" : "opacity-0")}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{o.label}</span>
                      {o.sublabel && (
                        <span className="truncate text-[10px] text-muted-foreground">{o.sublabel}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
