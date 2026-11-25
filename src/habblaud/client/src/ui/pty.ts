// Terminal interativo (pty) do agente, na versao da Growdash.
//
// O pty exige `node-pty` no servidor do Habblaud (a sessao do Claude Opus 5 Code
// roda dentro do navegador). A Growdash e uma SPA estatica na Cloudflare Pages,
// sem servidor Node: nao existe pty, nem para abrir sessao nova, nem para
// assumir a sessao de um agente.
//
// Este modulo mantem a interface `PtyControl` e uma implementacao desligada,
// com `enabled = false`. A UI usa esse `enabled` para esconder os botoes
// "Assumir daqui" e "Nova sessao", que nao teriam para onde ir.
import type { AgentInfo, PtyInfo } from '../../../shared/types';
import { tr } from '../../../shared/i18n';

/**
 * Terminal interativo desligado. Os metodos existem para satisfazer o
 * contrato; nenhum abre sessao.
 */
export interface PtyControl {
  /** Recurso ligado (fora do Docker, com node-pty e acesso local). */
  readonly enabled: boolean;
  /** Por que esta desligado. */
  readonly reason: string;
  /** Terminal interativo rodando deste agente. */
  ptyOf(agentId: string): PtyInfo | undefined;
  /** Agente aberto na janela (com pty ou aberto noutro terminal). */
  readonly agentId: string | null;
  readonly isOpen: boolean;
  /** Abre a janela no agente: o pty dele ou, se a sessao roda noutro terminal, a oferta de assumir. */
  openAgent(agentId: string): void;
  close(): void;
  takeover(agentId: string): Promise<void>;
  newSession(cwd: string, account?: string): Promise<void>;
  stop(agentId: string): Promise<void>;
}

const OFF_REASON = tr('O terminal interativo precisa do Habblaud rodando no computador.');

/** Implementacao desligada: `enabled` falso e nenhuma sessao e aberta. */
export const offlinePty: PtyControl = {
  enabled: false,
  reason: OFF_REASON,
  ptyOf(_agentId: string): PtyInfo | undefined {
    return undefined;
  },
  agentId: null,
  isOpen: false,
  openAgent(_agentId: string) {},
  close() {},
  async takeover(_agentId: string) {},
  async newSession(_cwd: string, _account?: string) {},
  async stop(_agentId: string) {},
};

/** So a interface e a implementacao desligada; a janela de terminal nao existe aqui. */
export type { AgentInfo };
