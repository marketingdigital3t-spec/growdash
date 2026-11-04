// Comparação constant-time: segredos não podem ser comparados com ===, que
// vaza informação de timing por tempo de resposta.
export function secretsMatch(received: string | null | undefined, expected: string | null | undefined) {
  const a = new TextEncoder().encode(String(received ?? ""));
  const b = new TextEncoder().encode(String(expected ?? ""));
  if (!a.length || a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}
