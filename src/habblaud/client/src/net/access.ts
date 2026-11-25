// Habblaud rodando dentro da Growdash: nao existe servidor local do Habblaud, logo
// nao ha "acesso local" nem "acesso remoto" para consultar.
//
// Este modulo substitui o `net/access.ts` do Habblaud original (que falava com
// GET /api/access do servidor Node). Aqui o acesso e decidido pela propria
// Growdash: a aba Agentes roda dentro do app autenticado, entao o usuario ve o
// que ve.
//
// O que muda em relacao ao original:
// - `permissions`, `messages` e `terminal` ficam desligados: responder a um
//   pedido de permissao, mandar mensagem a um agente e abrir o terminal
//   dependem do servidor local do Habblaud (o hook que espera a decisao). Sem
//   ele, o botao ficaria esperando uma resposta que nunca chega.
// - `local` e `remote` ficam falsos, porque os dois caminhos do original
//   (localhost para o proprio computador, remoto para o celular) nao se aplicam.
//
// A UI le `access()` para esconder botoes que nao funcionariam: os botoes de
// terminal, de responder permissao e de renomear sala ficam escondidos.
import type { AccessInfo } from '../../../shared/types';

let current: AccessInfo | null = null;
const listeners = new Set<() => void>();

/** Avisa quando o acesso muda (a UI redesenha os botoes). Devolve a funcao que cancela. */
export function onAccessChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => void listeners.delete(cb);
}

/** Hostname do proprio computador (localhost, *.localhost, 127.x, ::1). */
export function isLoopbackHostname(hostname: string): boolean {
  const name = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return name === 'localhost' || name.endsWith('.localhost') || name === '::1' || /^127(?:\.\d{1,3}){3}$/.test(name);
}

/**
 * Regra sem servidor: nada e liberado, porque cada recurso liberado dependia
 * do servidor local do Habblaud. `local` e `remote` ficam falsos para que a
 * UI esconda as acoes que so fazem sentido com aquele servidor.
 */
export function fallbackAccess(hostname: string): AccessInfo {
  void hostname;
  return { remote: false, local: false, permissions: false, messages: false, terminal: false, spawn: false };
}

/** Sem servidor para consultar: nao ha espera a configurar. */
export const ACCESS_TIMEOUT_MS = 0;

/** Acesso desta pagina. */
export function access(): AccessInfo {
  return current ?? fallbackAccess(typeof location === 'undefined' ? '' : location.hostname);
}

/**
 * Nao ha servidor: o acesso nunca muda. A funcao existe porque a UI original a
 * chama ao reconectar o stream.
 */
export async function loadAccess(fetchImpl: typeof fetch = fetch, go: (url: string) => void = (u) => location.assign(u)): Promise<AccessInfo> {
  void fetchImpl;
  void go;
  return access();
}

/** Sair do Habblaud remoto nao se aplica aqui (nao ha login do Habblaud). */
export async function remoteLogout(fetchImpl: typeof fetch = fetch, go: (url: string) => void = (u) => location.assign(u)): Promise<boolean> {
  void fetchImpl;
  void go;
  return false;
}

/** Fixa o acesso (usado nos testes). */
export function setAccess(a: AccessInfo | null): void {
  const prev = current;
  current = a;
  if (JSON.stringify(prev) !== JSON.stringify(a)) listeners.forEach((cb) => cb());
}
