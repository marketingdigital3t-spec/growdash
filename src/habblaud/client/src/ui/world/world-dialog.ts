// Janela do Habblaud World (o predio compartilhado entre os usuarios).
//
// O Habblaud World e um recurso multiplayer do Habblaud: ele depende do
// servidor do mundo (server.habblaud.com ou uma URL propria) e de uma conta
// aprovada. Nada disso existe na Growdash, que e uma SPA estatica.
//
// Este modulo mantem apenas o contrato `WorldThemeLink`, que as Configuracoes
// usam para avisar que o tema escolhido tambem vai para o predio. Como nao ha
// predio, o aviso fica vazio e `onThemePicked` nao faz nada.
import type { WorldThemeChoice } from '../../../../shared/world/api';
import type { UiComponent, UiContext } from '../context';

/**
 * O que as Configuracoes precisam do mundo: uma nota para o usuario e o
 * caminho de escolha do tema. Sem servidor do mundo, a nota e vazia.
 */
export interface WorldThemeLink {
  readonly themeNote: HTMLElement;
  onThemePicked(theme: WorldThemeChoice): Promise<void>;
}

/**
 * Link do mundo sem servidor: a nota fica vazia e escolher um tema nao faz
 * nada (o tema do escritorio continua valendo).
 */
export class WorldDialog implements UiComponent, WorldThemeLink {
  readonly el: HTMLDialogElement;
  readonly themeNote: HTMLElement;
  private open = false;

  constructor(_ctx: UiContext) {
    this.el = document.createElement('dialog');
    this.el.className = 'ui-world';
    this.el.hidden = true;
    this.themeNote = document.createElement('span');
    this.themeNote.className = 'ui-muted ui-small';
    this.themeNote.hidden = true;
  }

  /** A janela do mundo esta aberta? Sem servidor do mundo, nunca esta. */
  isOpen(): boolean {
    return this.open;
  }

  async onThemePicked(_theme: WorldThemeChoice): Promise<void> {}

  show(_screen?: unknown, _opener?: HTMLElement | null): void {
    this.open = true;
    this.el.hidden = false;
  }

  toggle(_opener?: HTMLElement | null): void {
    if (this.open) this.close();
    else this.show();
  }

  close(): void {
    this.open = false;
    this.el.hidden = true;
  }

  render(): void {}
}
