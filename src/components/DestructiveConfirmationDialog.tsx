import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmation: string;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
};

export function DestructiveConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmation,
  confirmLabel = "Excluir definitivamente",
  pending = false,
  onConfirm,
}: Props) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  const matches = typed === confirmation;

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <span className="mb-2 grid h-11 w-11 place-items-center rounded-xl bg-destructive/10 text-destructive">
            <TriangleAlert className="h-5 w-5" />
          </span>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="leading-relaxed">{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 rounded-xl border border-destructive/20 bg-destructive/[.035] p-4">
          <Label htmlFor="destructive-confirmation" className="text-xs leading-relaxed">
            Digite <strong className="select-all text-foreground">{confirmation}</strong> para confirmar
          </Label>
          <Input
            id="destructive-confirmation"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            disabled={pending}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancelar</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={!matches || pending}>
            {pending ? "Excluindo…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
