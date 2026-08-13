import { lazy, type ComponentType, type LazyExoticComponent } from "react";

export type RuntimeDiagnostic = {
  at: string;
  scope: string;
  message: string;
  recoverable: boolean;
};

const DIAGNOSTICS_KEY = "growdash:runtime-diagnostics";
const CHUNK_ERROR = /dynamically imported module|loading chunk|importing a module script|failed to fetch|module script/i;

export function isRecoverableChunkError(error: unknown) {
  return CHUNK_ERROR.test(error instanceof Error ? error.message : String(error));
}

export function recordRuntimeDiagnostic(scope: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const entry: RuntimeDiagnostic = { at: new Date().toISOString(), scope, message: message.slice(0, 500), recoverable: isRecoverableChunkError(error) };
  try {
    const previous = JSON.parse(sessionStorage.getItem(DIAGNOSTICS_KEY) || "[]");
    const history = Array.isArray(previous) ? previous.slice(-19) : [];
    history.push(entry);
    sessionStorage.setItem(DIAGNOSTICS_KEY, JSON.stringify(history));
  } catch {
    // Diagnóstico nunca pode impedir a recuperação da interface.
  }
  return entry;
}

const wait = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

/**
 * Atualizações do Pages substituem arquivos com hash. Se uma aba antiga pede
 * um chunk que acabou de ser trocado, tentamos o import novamente antes de
 * propagar o erro para a fronteira da rota. Isso evita uma falha transitória
 * transformar-se em indisponibilidade da plataforma inteira.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
  scope: string,
): LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await loader();
      } catch (error) {
        lastError = error;
        if (!isRecoverableChunkError(error) || attempt === 2) break;
        await wait((attempt + 1) * 1_000);
      }
    }
    recordRuntimeDiagnostic(scope, lastError);
    throw lastError instanceof Error ? lastError : new Error(`Não foi possível carregar ${scope}.`);
  });
}
