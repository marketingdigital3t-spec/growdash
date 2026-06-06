import { DatePreset } from "@/hooks/useDateFilter";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { MetaDateRangePicker } from "./MetaDateRangePicker";
import { CampaignMultiSelect } from "./CampaignMultiSelect";

interface DateFilterBarProps {
  preset: DatePreset;
  onPresetChange: (preset: DatePreset) => void;
  customRange: { from: Date; to: Date };
  onCustomRangeChange: (range: { from: Date; to: Date }) => void;
  startDate: Date;
  endDate: Date;
  adAccounts: { id: string; name: string }[];
  selectedAccount: string;
  onAccountChange: (id: string) => void;
  campaigns?: { id: string; name: string }[];
  selectedCampaignIds?: string[];
  onCampaignIdsChange?: (ids: string[]) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function DateFilterBar({
  preset,
  onPresetChange,
  customRange,
  onCustomRangeChange,
  startDate,
  endDate,
  adAccounts,
  selectedAccount,
  onAccountChange,
  campaigns = [],
  selectedCampaignIds = [],
  onCampaignIdsChange,
  onRefresh,
  isRefreshing,
}: DateFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <MetaDateRangePicker
        preset={preset}
        onPresetChange={onPresetChange}
        customRange={customRange}
        onCustomRangeChange={onCustomRangeChange}
        startDate={startDate}
        endDate={endDate}
      />

      {adAccounts.length > 0 && (
        <Select value={selectedAccount} onValueChange={onAccountChange}>
          <SelectTrigger className="w-[200px] bg-card">
            <SelectValue placeholder="Todas as contas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as contas</SelectItem>
            {adAccounts.map((acc) => (
              <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {campaigns.length > 0 && onCampaignIdsChange && (
        <CampaignMultiSelect
          campaigns={campaigns}
          selectedIds={selectedCampaignIds}
          onChange={onCampaignIdsChange}
        />
      )}

      {onRefresh && (
        <Button variant="outline" size="icon" onClick={onRefresh} disabled={isRefreshing} className="bg-card">
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
        </Button>
      )}

      <span className="text-xs text-muted-foreground ml-auto">
        {format(startDate, "dd MMM", { locale: ptBR })} — {format(endDate, "dd MMM yyyy", { locale: ptBR })}
      </span>
    </div>
  );
}
