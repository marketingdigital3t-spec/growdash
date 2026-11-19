/**
 * Testes unitários para src/lib/workspaceBootstrapPolicy.ts.
 *
 * Comportamento sob teste: quando o bootstrap do workspace falha, a política
 * decide se a interface usa o cache local (continuando utilizável) ou
 * propaga o erro (para não mascarar falha de autorização).
 *
 * Não existe arquivo de teste anterior para esta política — este é o
 * primeiro. O módulo fonte (workspaceBootstrapPolicy.ts) foi criado neste
 * ciclo de auditoria e é usado por src/hooks/useWorkspace.ts e
 * src/hooks/useIsMaster.ts.
 *
 * Instrução verbatim do usuário: "agora eu quero que você resolva toda essa
 * bosta de problema que eu estou tendo na minha plataforma, ou dados da
 * integração do meta ads e do rd station crm esta tudo errado e bugando,
 * corriga para mim urgente"
 */

import { describe, expect, it } from "vitest";
import {
  decideWorkspaceBootstrapFallback,
  isWorkspaceTimeoutError,
  IS_MASTER_TIMEOUT_MS,
  WORKSPACE_BOOTSTRAP_READ_TIMEOUT_MS,
  WORKSPACE_BOOTSTRAP_TOTAL_TIMEOUT_MS,
} from "./workspaceBootstrapPolicy";

describe("workspaceBootstrapPolicy — decisão de fallback do bootstrap", () => {
  describe("timeout com cache", () => {
    it("usa o cache para manter a interface utilizável", () => {
      expect(
        decideWorkspaceBootstrapFallback({ timedOut: true, hasCache: true }),
      ).toEqual({ action: "use-cache", reason: "timeout-with-cache" });
    });
  });

  describe("timeout sem cache", () => {
    it("propaga para permitir nova tentativa", () => {
      expect(
        decideWorkspaceBootstrapFallback({ timedOut: true, hasCache: false }),
      ).toEqual({ action: "retry", reason: "timeout-without-cache" });
    });
  });

  describe("erro não-timeout com cache", () => {
    it("usa o cache preservando a tela", () => {
      expect(
        decideWorkspaceBootstrapFallback({ timedOut: false, hasCache: true }),
      ).toEqual({ action: "use-cache", reason: "error-with-cache" });
    });
  });

  describe("erro não-timeout sem cache", () => {
    it("propaga o erro para não mascarar falha de autorização", () => {
      expect(
        decideWorkspaceBootstrapFallback({ timedOut: false, hasCache: false }),
      ).toEqual({ action: "throw", reason: "error-without-cache" });
    });
  });

  describe("isWorkspaceTimeoutError", () => {
    it("reconhece a mensagem padrão do withRequestTimeout", () => {
      expect(isWorkspaceTimeoutError(new Error("Tempo de carregamento excedido."))).toBe(true);
    });

    it("reconhece timeout em inglês", () => {
      expect(isWorkspaceTimeoutError(new Error("Request timeout"))).toBe(true);
      expect(isWorkspaceTimeoutError(new Error("The operation was aborted"))).toBe(true);
    });

    it("não confunde erro de autorização com timeout", () => {
      expect(isWorkspaceTimeoutError(new Error("JWT expired"))).toBe(false);
      expect(isWorkspaceTimeoutError(new Error("permission denied for table workspaces"))).toBe(false);
    });

    it("aceita valores não-Error", () => {
      expect(isWorkspaceTimeoutError("Tempo de carregamento excedido.")).toBe(true);
      expect(isWorkspaceTimeoutError(null)).toBe(false);
      expect(isWorkspaceTimeoutError(undefined)).toBe(false);
    });
  });

  describe("orçamento de tempo", () => {
    it("o total da cadeia comporta as leituras paralelas", () => {
      expect(WORKSPACE_BOOTSTRAP_TOTAL_TIMEOUT_MS).toBeGreaterThan(WORKSPACE_BOOTSTRAP_READ_TIMEOUT_MS);
    });

    it("is_master tem folga sobre o timeout padrão de 8s", () => {
      expect(IS_MASTER_TIMEOUT_MS).toBeGreaterThan(8_000);
    });
  });
});
