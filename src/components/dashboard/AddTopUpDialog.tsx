import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  date: z.date(),
  amount: z.number().positive().max(1_000_000),
  method: z.string().min(1).max(40),
  reference: z.string().max(120).optional(),
});

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  accountId: string;
  accountName: string;
}

export function AddTopUpDialog({ open, onOpenChange, accountId, accountName }: Props) {
  const qc = useQueryClient();
  const [date, setDate] = useState<Date>(new Date());
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cartão");
  const [reference, setReference] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({
        date,
        amount: Number(amount.replace(",", ".")),
        method,
        reference: reference || undefined,
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      }
      const id = `manual_${crypto.randomUUID()}`;
      const { error } = await supabase.from("account_transactions").insert({
        id,
        ad_account_id: accountId,
        time: parsed.data.date.toISOString(),
        amount: parsed.data.amount,
        currency: "BRL",
        status: "paid",
        payment_method: parsed.data.method,
        billing_reason: "manual",
        reference: parsed.data.reference ?? null,
        raw: { source: "manual" } as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aporte registrado");
      qc.invalidateQueries({ queryKey: ["budget_history"] });
      setAmount("");
      setReference("");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao registrar aporte"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-base">Registrar aporte — {accountName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Data do pagamento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "dd 'de' MMM yyyy", { locale: ptBR }) : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Valor (R$)</Label>
            <Input
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Método de pagamento</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Cartão">Cartão</SelectItem>
                <SelectItem value="Pix">Pix</SelectItem>
                <SelectItem value="Boleto">Boleto</SelectItem>
                <SelectItem value="Saldo pré-pago">Saldo pré-pago</SelectItem>
                <SelectItem value="Outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Referência (opcional)</Label>
            <Input
              placeholder="Ex: NF 12345, recibo Meta..."
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              maxLength={120}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !amount}>
            {mutation.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Registrar aporte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
