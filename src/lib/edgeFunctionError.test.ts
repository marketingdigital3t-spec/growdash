import { describe, expect, it } from "vitest";
import { edgeFunctionErrorDetails, formatEdgeFunctionError } from "./edgeFunctionError";

describe("edgeFunctionErrorDetails", () => {
  it("extracts the real Meta error from a non-2xx response", async () => {
    const error = Object.assign(new Error("Edge Function returned a non-2xx status code"), {
      context: new Response(JSON.stringify({ error: "Token expirado", code: 190, error_subcode: 463 }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    });

    const details = await edgeFunctionErrorDetails(error);
    expect(details).toMatchObject({ message: "Token expirado", status: 401, code: 190, subcode: 463, needsReauth: true });
    expect(formatEdgeFunctionError(details)).toContain("HTTP 401");
  });

  it("keeps a safe fallback for network errors", async () => {
    const details = await edgeFunctionErrorDetails(new Error("Falha de rede"));
    expect(details.message).toBe("Falha de rede");
    expect(details.needsReauth).toBe(false);
  });
});
