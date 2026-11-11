import { useEffect, useState } from "react";

/**
 * Retarda a atualização de um valor até que o usuário pare de digitar pelo
 * intervalo configurado (padrão: 300ms). Evita requisições e recálculos síncronos
 * a cada tecla digitada (Item 04 da auditoria de performance).
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
