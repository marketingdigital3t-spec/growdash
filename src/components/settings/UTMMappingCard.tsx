import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useAccountUtmMappings, useUpsertAccountUtmMapping, DEFAULT_MAPPING, type UtmField, type MatchStrategy } from "@/hooks/useAccountUtmMapping";
import { Loader2, Settings2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const UTM_OPTIONS: { value: UtmField; label: string }[] = [
  { value: "utm_campaign", label: "utm_campaign" },
  { value: "utm_term", label: "utm_term" },
  { value: "utm_content", label: "utm_content" },
  { value: "utm_source", label: "utm_source" },
  { value: "utm_medium", label: "utm_medium" },
  { value: "ad_id", label: "ad_id (Meta utm_id)" },
];

const STRATEGY_OPTIONS: { value: MatchStrategy; label: string; desc: string }[] = [
  { value: "exact", label: "Exato", desc: "Bate apenas se idêntico" },
  { value: "normalized", label: "Normalizado", desc: "Ignora caixa, hífen, underscore, espaços" },
  { value: "contains", label: "Contém", desc: "Combina se um valor contém o outro" },
];

export function UTMMappingCard() {
  const { data: accounts = [] } = useAdAccounts();
  const { data: mappings = [], isLoading } = useAccountUtmMappings();
  const upsert = useUpsertAccountUtmMapping();
  const { toast } = useToast();

  const mappingFor = (accountId: string) =>
    mappings.find((m) => m.ad_account_id === accountId) ?? { ad_account_id: accountId, ...DEFAULT_MAPPING };

  const save = async (accountId: string, patch: Partial<{ campaign_utm: UtmField; adset_utm: UtmField; creative_utm: UtmField; platform_utm: UtmField; match_strategy: MatchStrategy }>) => {
    const current = mappingFor(accountId);
    try {
      await upsert.mutateAsync({ ad_account_id: accountId, ...current, ...patch });
      toast({ title: "Mapeamento salvo" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          <CardTitle>Mapeamento de UTMs por conta</CardTitle>
        </div>
        <CardDescription>
          Defina qual UTM identifica a campanha, conjunto e criativo em cada conta de anúncios.
          Usado para atribuir vendas do RD aos anúncios automaticamente.
          A identificação da plataforma/origem é configurada em "Plataformas e Origens".
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Cadastre uma conta primeiro.</p>
        ) : (
          accounts.map((acc) => {
            const m = mappingFor(acc.id);
            return (
              <div key={acc.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{acc.name}</div>
                    <div className="text-xs text-muted-foreground">{acc.account_id}</div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{STRATEGY_OPTIONS.find((s) => s.value === m.match_strategy)?.label}</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Field label="Campanha" value={m.campaign_utm} onChange={(v) => save(acc.id, { campaign_utm: v })} />
                  <Field label="Conjunto" value={m.adset_utm} onChange={(v) => save(acc.id, { adset_utm: v })} />
                  <Field label="Criativo" value={m.creative_utm} onChange={(v) => save(acc.id, { creative_utm: v })} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Estratégia de match</label>
                    <Select value={m.match_strategy} onValueChange={(v) => save(acc.id, { match_strategy: v as MatchStrategy })}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STRATEGY_OPTIONS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            <div>
                              <div>{s.label}</div>
                              <div className="text-[10px] text-muted-foreground">{s.desc}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange }: { label: string; value: UtmField; onChange: (v: UtmField) => void }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <Select value={value} onValueChange={(v) => onChange(v as UtmField)}>
        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {UTM_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
