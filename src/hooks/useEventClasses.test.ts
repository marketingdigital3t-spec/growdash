import { describe, expect, it } from "vitest";
import { describeEventClassPermissionError } from "./useEventClasses";

describe("event class authorization errors", () => {
  it("explains RLS and forbidden responses without exposing raw database text", () => {
    expect(describeEventClassPermissionError({ code: "42501", message: "new row violates row-level security policy" }))
      .toBe("Você não tem permissão para alterar esta turma ou a conta Meta vinculada.");
    expect(describeEventClassPermissionError({ status: 403, message: "Forbidden" }))
      .toBe("Você não tem permissão para alterar esta turma ou a conta Meta vinculada.");
  });

  it("distinguishes expired sessions from authorization failures", () => {
    expect(describeEventClassPermissionError({ status: 401 })).toContain("sessão expirou");
    expect(describeEventClassPermissionError(new Error("Falha de rede"))).toBe("Falha de rede");
  });
});
