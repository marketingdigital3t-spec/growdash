import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export const UF_LIST = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

interface Props {
  value: string | null | undefined;
  onSave: (v: string) => unknown | Promise<unknown>;
  placeholder?: string;
  type?: "text" | "uf";
  className?: string;
}

/**
 * Renders the value as plain text when filled (read-only). When empty, shows
 * a "Adicionar" button that opens an inline editor. Once saved, the field is
 * locked again — values from RD or filled manually cannot be re-edited here.
 */
export function EditableIfEmpty({ value, onSave, placeholder = "Adicionar", type = "text", className = "" }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  if (value && value.trim() !== "") {
    return <span className={`text-sm ${className}`}>{value}</span>;
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setDraft(""); setEditing(true); }}
        className={`inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors ${className}`}
      >
        <Pencil className="h-3 w-3" />
        {placeholder}
      </button>
    );
  }

  const commit = async () => {
    if (!draft.trim()) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(draft.trim()); setEditing(false); }
    finally { setSaving(false); }
  };

  return (
    <div className="flex items-center gap-1">
      {type === "uf" ? (
        <Select value={draft} onValueChange={setDraft}>
          <SelectTrigger className="h-7 w-[80px] text-xs"><SelectValue placeholder="UF" /></SelectTrigger>
          <SelectContent className="max-h-60">
            {UF_LIST.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          className="h-7 w-[140px] text-xs"
        />
      )}
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={commit} disabled={saving}>
        <Check className="h-3 w-3" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(false)} disabled={saving}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
