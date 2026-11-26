import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const hookSource = readFileSync(
  fileURLToPath(new URL("./useRDAccountConnections.ts", import.meta.url)),
  "utf8",
);
const integrationsPage = readFileSync(
  fileURLToPath(new URL("../growdash/IntegrationsPage.tsx", import.meta.url)),
  "utf8",
);
const globalFilters = readFileSync(
  fileURLToPath(new URL("../contexts/GlobalFiltersContext.tsx", import.meta.url)),
  "utf8",
);

describe("RD account connections scope", () => {
  it("resolves the workspace inside the hook so every caller uses the workspace RPC", () => {
    // The table policy is `auth.uid() = user_id`, so a direct SELECT can never
    // return connections owned by another workspace member. The SECURITY
    // DEFINER RPC is the only path that lists workspace connections.
    expect(hookSource).toContain("useWorkspace()");
    expect(hookSource).toContain('rpc("list_workspace_rd_account_connections"');
    expect(hookSource).toContain("const workspaceId = workspace?.id");
  });

  it("keeps the request budget aligned with the other integration queries", () => {
    // A 2.5s ceiling with no retry turned a slow-but-successful workspace
    // query into a hard failure on the integrations screen.
    expect(hookSource).not.toContain("RD_SCOPE_TIMEOUT_MS = 2_500");
    expect(hookSource).toMatch(/RD_SCOPE_TIMEOUT_MS = (8_000|12_000)/);
    expect(hookSource).toContain("retry: 1");
  });

  it("waits for the workspace before firing the query", () => {
    expect(hookSource).toContain("!workspaceLoading");
  });

  it("never calls the hook with a positional workspace id", () => {
    expect(globalFilters).not.toMatch(/useRDAccountConnections\(\s*workspace\?\.id/);
    expect(integrationsPage).toMatch(/useRDAccountConnections\(\s*\)/);
  });

  it("surfaces the real cause instead of a generic failure banner", () => {
    expect(integrationsPage).toContain("rdConnectionsError");
    expect(integrationsPage).not.toContain("Falha ao carregar conexões RD.");
  });
});
