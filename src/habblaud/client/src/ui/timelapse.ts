// Timelapse: reproduzir o dia que passou no escritorio.
//
// O timelapse do Habblaud le o historico gravado pelo servidor (GET
// /api/timeline/days e /api/timeline/:dia). Na Growdash nao ha esse servidor, e o
// `store` so expoe o snapshot atual, entao nao ha o que reproduzir.
//
// Este modulo mantem os icones (o botao da barra do topo) e um player desligado.
// A barra esconde o botao quando o store esta em modo mock, que e o caso aqui.
import type { WorldPlayback } from '../world/api';
import type { UiComponent, UiContext } from './context';
import { h, iconButton } from './dom';

export const SPEEDS = [60, 180, 600] as const;
export type Speed = (typeof SPEEDS)[number];

export const TIMELAPSE_ICONS = {
  timelapse: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="2" y="3" width="12" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5 6.5h6M5 9h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M8 1.5v2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  play: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M5 3.5l7 4.5-7 4.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="5" y="4" width="2" height="8" fill="currentColor"/><rect x="9" y="4" width="2" height="8" fill="currentColor"/></svg>',
};

/** Rotulo do dia ("hoje", "ontem", a data). */
export function dayLabel(day: string, today: string): string {
  if (day === today) return 'Hoje';
  return day;
}

/** As horas mostradas na linha do tempo. */
export function hourTicks(from: number, to: number): number[] {
  const out: number[] = [];
  for (let h = Math.ceil(from); h <= to; h += 1) out.push(h);
  return out;
}

/**
 * Player desligado: sem historico para reproduzir, `toggle` nao faz nada e o
 * mundo nunca entra em modo de reproducao.
 */
export class TimelapsePlayer implements UiComponent {
  readonly el: HTMLElement;
  readonly badge: HTMLElement;
  readonly vignette: HTMLElement;
  private open = false;

  constructor(_ctx: UiContext) {
    this.el = h('div', { class: 'ui-lapse', attrs: { hidden: 'true' } });
    this.badge = h('div', { class: 'ui-lapse-badge', attrs: { hidden: 'true' } });
    this.vignette = h('div', { class: 'ui-lapse-vignette', attrs: { hidden: 'true' } });
  }

  render(): void {}

  isOpen(): boolean {
    return this.open;
  }

  toggle(): void {}

  open_(): void {}

  close(): void {}

  /** Sem reproducao: o mundo continua ao vivo. */
  playback(): WorldPlayback | null {
    return null;
  }
}

/** Botao do timelapse, quando alguma UI quiser montar um. */
export function timelapseButton(onClick: () => void): HTMLButtonElement {
  return iconButton(TIMELAPSE_ICONS.timelapse, 'Timelapse', onClick, 'ui-btn-timelapse');
}
