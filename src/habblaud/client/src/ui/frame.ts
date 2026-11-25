// O "frame" do escritorio: o retangulo que o Habblaud ocupa dentro da Growdash.
//
// No Habblaud original o escritorio ocupa a janela inteira: os paineis sao
// `position: fixed` e as coordenadas sao as da tela (`innerWidth`, `clientX`).
// Na Growdash o escritorio vive dentro da aba Agentes, que tem a barra lateral
// e a navegacao da plataforma ao redor.
//
// A solucao esta no CSS: o host do escritorio tem um `transform`, o que o torna
// o bloco contentor dos descendentes `position: fixed`. Os paineis continuam
// `fixed` no CSS original e passam a se posicionar dentro do host, sem mexer em
// nenhuma regra do Habblaud.
//
// O que este modulo resolve e a matematica: os trechos de codigo que mediam a
// tela (para posicionar a dica flutuante, o campo de renomear, o popover de
// configuracoes e a janela movel da gaveta) passam a medir o frame.
import type { UiContext } from './context';

let host: HTMLElement | null = null;

/** Registra o elemento que contem o escritorio (o host). */
export function setFrame(el: HTMLElement | null): void {
  host = el;
}

/** O host do escritorio, se ja foi montado. */
export function frame(): HTMLElement | null {
  return host;
}

/** Largura e altura do frame em px CSS. Cai no viewport quando o host nao existe. */
export function frameSize(): { w: number; h: number } {
  if (!host) return { w: typeof innerWidth === 'number' ? innerWidth : 0, h: typeof innerHeight === 'number' ? innerHeight : 0 };
  return { w: host.clientWidth, h: host.clientHeight };
}

/**
 * Converte coordenadas de tela (`clientX`/`clientY`) para relativas ao frame.
 * As que ja sao relativas ao canvas (o canvas preenche o frame) nao mudam.
 */
export function toFrame(clientX: number, clientY: number): { x: number; y: number } {
  if (!host) return { x: clientX, y: clientY };
  const r = host.getBoundingClientRect();
  return { x: clientX - r.left, y: clientY - r.top };
}

/**
 * O retangulo do frame em coordenadas de tela (viewport). Usado para converter
 * um `getBoundingClientRect()` de um painel em coordenada do frame.
 */
export function frameRect(): DOMRect | null {
  return host ? host.getBoundingClientRect() : null;
}

/**
 * Instala o frame a partir do contexto: a raiz da UI (`#ui`) mora dentro do
 * host do escritorio, entao o host e o pai do container da UI.
 */
export function bindFrame(ctx: UiContext): void {
  const ui = ctx.root;
  const parent = ui.parentElement;
  setFrame(parent?.classList.contains('habblaud-office-host') ? parent : null);
}
