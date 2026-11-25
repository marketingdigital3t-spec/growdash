// "Novo agente": abrir uma sessao do Claude Opus 5 Code numa pasta, direto do
// escritorio.
//
// Na Growdash nao ha servidor local do Habblaud, entao nao existe comando para
// iniciar uma sessao: este modulo mantem apenas as funcoes puras (as pastas
// conhecidas e os formatadores) e um painel desligado, que nunca abre.
import { tr } from '../../../shared/i18n';
import type { OfficeSnapshot } from '../../../shared/types';
import type { UiContext } from './context';

export const SPAWN_PROMPT_MAX = 8_000;
export const MAX_FILES = 8;
export const MAX_FILE_BYTES = 15 * 1024 * 1024;

export interface FolderOption {
  path: string;
  label: string;
}

/** Pastas com sessao aberta no escritorio. */
export function spawnFolders(snap: Pick<OfficeSnapshot, 'rooms' | 'agents'> | null | undefined): string[] {
  if (!snap) return [];
  return snap.rooms.map((room) => room.path).filter(Boolean);
}

/** Caminho curto para caber na lista: o ultimo elo e o nome da pasta. */
export function shortPath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts.length <= 1 ? path : parts[parts.length - 1];
}

/** "ha 5 min" */
export function ago(at: number, now = Date.now()): string {
  const diff = Math.max(0, now - at);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return tr('agora');
  if (min < 60) return tr('há {0} min', [min]);
  const hours = Math.floor(min / 60);
  if (hours < 24) return tr('há {0} h', [hours]);
  return tr('há {0} d', [Math.floor(hours / 24)]);
}

/** "1,2 MB" */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Painel de novo agente, desligado. A UI esconde o botao (o `access().spawn` e
 * falso), entao este painel existe apenas para o contrato de importacao.
 */
export class SpawnPanel {
  readonly el: HTMLElement;

  constructor(_ctx: UiContext) {
    this.el = document.createElement('div');
    this.el.hidden = true;
  }

  toggle(_opener?: HTMLElement | null): void {}
}
