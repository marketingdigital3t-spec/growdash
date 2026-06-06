import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  readOnly?: boolean;
  placeholder?: string;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBRL(text: string): number {
  const cleaned = text.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function CurrencyInput({ value, onChange, className, readOnly, placeholder }: CurrencyInputProps) {
  const [display, setDisplay] = useState(formatBRL(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDisplay(formatBRL(value));
    }
  }, [value, focused]);

  return (
    <Input
      value={display}
      readOnly={readOnly}
      className={className}
      placeholder={placeholder}
      onChange={(e) => {
        setDisplay(e.target.value);
        onChange(parseBRL(e.target.value));
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        setDisplay(formatBRL(parseBRL(display)));
      }}
    />
  );
}
