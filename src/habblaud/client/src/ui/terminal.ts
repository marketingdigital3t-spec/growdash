// Terminal do agente, na versao da Growdash: o terminal interativo (o Claude Opus 5 Code
// rodando dentro do navegador, via node-pty no servidor do Habblaud) nao existe
// aqui, porque a Growdash e uma SPA estatica na Cloudflare Pages.
//
// Este modulo mantem o que nao depende do servidor:
// - as funcoes puras de previa e de rotulo, usadas pela UI de permissao para
//   mostrar o pedido de um agente (comando, diff, JSON...) de forma resumida;
// - a interface `TerminalControl`, que a gaveta de detalhes consome.
//
// O painel de terminal em si foi retirado: abrir uma sessao do Claude Opus 5 Code
// exige o servidor local do Habblaud.
import type { RecentSession, TerminalEntry } from '../../../shared/types';
import { tr } from '../../../shared/i18n';

export const TERMINAL_DOM_LIMIT = 1500;
export const RESULT_PREVIEW_LINES = 6;
export const INPUT_PREVIEW_LINES = 10;
export const PROMPT_PREVIEW_LINES = 24;

/** Aviso exibido onde o terminal estaria: aqui o recurso nao existe. */
export const TERMINAL_UNAVAILABLE_HINT = tr('O terminal não fica disponível dentro do Growdash: ele precisa do Habblaud rodando no computador.');

export type ToolEntry = Extract<TerminalEntry, { kind: 'tool' }>;
export type ResultEntry = Extract<TerminalEntry, { kind: 'result' }>;
export type PlainEntry = Exclude<TerminalEntry, ToolEntry | ResultEntry>;

export interface TextPreview {
  /** Texto completo (sem espaços/linhas em branco no fim). */
  text: string;
  /** O que aparece recolhido. */
  head: string;
  /** Ha mais do que a previa mostra. */
  collapsed: boolean;
  /** Linhas escondidas na previa (0 quando o corte foi no meio de uma linha comprida). */
  hiddenLines: number;
  total: number;
}

/** Onde cortar a previa: o texto recolhido e `text.slice(0, headEnd)` (mais "…" quando `ellipsis`). */
export interface PreviewSplit {
  text: string;
  headEnd: number;
  /** O corte foi no meio de uma linha comprida (e nao numa quebra de linha). */
  ellipsis: boolean;
  collapsed: boolean;
  hiddenLines: number;
  total: number;
}

/**
 * Previa recolhida de um texto longo: as primeiras `maxLines` linhas (e no maximo `maxChars` caracteres).
 * So recolhe se sobrarem ao menos 3 linhas (esconder 1 ou 2 linhas atras de um clique nao compensa).
 */
export function splitPreview(raw: string, maxLines: number, maxChars = maxLines * 200): PreviewSplit {
  const text = raw.replace(/\s+$/, '');
  const lines = text === '' ? [] : text.split('\n');
  const total = lines.length;
  if (total <= maxLines + 2 && text.length <= maxChars) return { text, headEnd: text.length, ellipsis: false, collapsed: false, hiddenLines: 0, total };
  let shown = Math.min(total, maxLines);
  let headEnd = lines.slice(0, shown).join('\n').length;
  let ellipsis = false;
  if (headEnd > maxChars) {
    headEnd = text.slice(0, maxChars).replace(/\s+$/, '').length;
    ellipsis = true;
    shown = text.slice(0, headEnd).split('\n').length;
  }
  return { text, headEnd, ellipsis, collapsed: true, hiddenLines: Math.max(0, total - shown), total };
}

/** A mesma previa como texto (o que aparece recolhido em `head`). */
export function previewText(raw: string, maxLines: number, maxChars = maxLines * 200): TextPreview {
  const p = splitPreview(raw, maxLines, maxChars);
  const head = p.collapsed ? `${p.text.slice(0, p.headEnd)}${p.ellipsis ? '…' : ''}` : p.text;
  return { text: p.text, head, collapsed: p.collapsed, hiddenLines: p.hiddenLines, total: p.total };
}

/** Rotulo do botao que expande: "… +12 linhas" (ou "… mostrar tudo" quando o corte foi numa linha comprida). */
export function moreLabel(hiddenLines: number): string {
  if (hiddenLines <= 0) return tr('… mostrar tudo');
  return `… +${hiddenLines} ${hiddenLines === 1 ? tr('linha') : tr('linhas')}`;
}

/** "Bash(npm test)" -> nome em destaque + argumentos, como o Claude Opus 5 Code mostra. */
export function splitToolTitle(title: string): { name: string; args: string } {
  const i = title.indexOf('(');
  if (i > 0 && title.endsWith(')') && !/\s/.test(title.slice(0, i))) return { name: title.slice(0, i), args: title.slice(i) };
  return { name: title, args: '' };
}

/** Mostra o `input` da_tool? Um comando que ja cabe inteiro no titulo nao se repete embaixo. */
export function showToolInput(tool: Pick<ToolEntry, 'title' | 'input' | 'inputKind'>): boolean {
  const input = tool.input?.trim();
  if (!input) return false;
  if ((tool.inputKind ?? 'text') === 'command' && !input.includes('\n') && tool.title.includes(input)) return false;
  return true;
}

export type DiffLineKind = 'add' | 'del' | 'hunk' | 'ctx';

export function diffLineKind(line: string): DiffLineKind {
  if (line.startsWith('+')) return 'add';
  if (line.startsWith('-')) return 'del';
  if (line.startsWith('@@')) return 'hunk';
  return 'ctx';
}

/**
 * Terminal do agente. Sem servidor local do Habblaud, ele nunca abre: os metodos
 * sao os mesmos do original, mas nada acontece. A UI esconde o botao (o
 * `access().terminal` e falso), entao estes caminhos servem de rede de seguranca.
 */
export interface TerminalControl {
  /** Agente com o terminal aberto (null = fechado ou mostrando uma sessao do historico). */
  readonly agentId: string | null;
  open(agentId: string, opener?: HTMLElement | null): void;
  /** Abre uma sessao do historico: a conversa do transcript ou, se ela ainda estiver aberta, o terminal ao vivo do agente. */
  openSession(session: RecentSession, opener?: HTMLElement | null): void;
  close(): void;
  toggle(agentId: string, opener?: HTMLElement | null): void;
}

/** Terminal indisponivel: a interface existe, mas nada abre. */
export const offlineTerminal: TerminalControl = {
  agentId: null,
  open() {},
  openSession() {},
  close() {},
  toggle() {},
};
