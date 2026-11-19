/**
 * Política de contraste da interface.
 *
 * A auditoria de acessibilidade (GRO-A11Y-001) reprovou os textos
 * secundários do tema claro: contraste de 2.20:1 contra o mínimo de 4.5:1
 * exigido pela WCAG 2.2 AA para texto normal.
 *
 * O valor "2.20:1" do relatório vem de textos sobre superfícies escuras
 * (cards de indicador com fundo gradiente) que herdaram a escala de neutros
 * escuros, enquanto o tema claro pintava texto claro sobre fundo escuro.
 *
 * Este módulo calcula contraste WCAG real e expõe a autoridade de tokens
 * para que a correção seja testável sem navegador.
 */

/** Razão mínima WCAG 2.2 AA para texto normal. */
export const WCAG_AA_NORMAL_TEXT = 4.5;

/** Razão mínima WCAG 2.2 AA para texto grande (>= 18.66px bold ou 24px). */
export const WCAG_AA_LARGE_TEXT = 3;

function hexToRgb(hex: string): [number, number, number] | null {
  const normalized = hex.trim().replace(/^#/, "");
  const full = normalized.length === 3
    ? normalized.split("").map((char) => char + char).join("")
    : normalized;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste WCAG entre duas cores hexadecimais. */
export function contrastRatio(foreground: string, background: string): number | null {
  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);
  if (!fg || !bg) return null;
  const lighter = Math.max(relativeLuminance(fg), relativeLuminance(bg));
  const darker = Math.min(relativeLuminance(fg), relativeLuminance(bg));
  return (lighter + 0.05) / (darker + 0.05);
}

/** Verdadeiro quando o par de cores atinge o nível WCAG AA. */
export function meetsWcagAA(foreground: string, background: string, largeText = false): boolean {
  const ratio = contrastRatio(foreground, background);
  if (ratio == null) return false;
  return ratio >= (largeText ? WCAG_AA_LARGE_TEXT : WCAG_AA_NORMAL_TEXT);
}

/**
 * Autoridade de tokens do tema claro para texto secundário.
 *
 * Sobre superfície branca (#ffffff) o cinza anterior (#666666) atingia
 * 5.74:1, mas o mesmo token é aplicado sobre superfícies levemente
 * coloridas onde a razão cai. Um cinza mais escuro garante folga em
 * qualquer uma dessas superfícies.
 */
export const LIGHT_THEME_CONTENT_TOKENS = {
  background: "#ffffff",
  text: "#111111",
  muted: "#4b5563",
  disabled: "#5c6861",
  border: "rgba(16, 74, 45, .24)",
} as const;

/**
 * Escolhe a cor de texto secundário que atende o contraste mínimo sobre
 * uma lista de superfícies conhecidas.
 *
 * A ordem é da mais escura para a mais clara: a primeira que passa em
 * todas as superfícies é usada.
 */
export function pickAccessibleMutedColor(
  candidates: readonly string[],
  backgrounds: readonly string[],
  minimum = WCAG_AA_NORMAL_TEXT,
): string | null {
  for (const candidate of candidates) {
    const passesEverywhere = backgrounds.every((background) => {
      const ratio = contrastRatio(candidate, background);
      return ratio != null && ratio >= minimum;
    });
    if (passesEverywhere) return candidate;
  }
  return null;
}
