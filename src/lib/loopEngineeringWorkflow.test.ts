import { readFileSync } from "node:fs";

describe("loop engineering workflow", () => {
  it("runs manual and scheduled detection and uploads a report without deploy", () => {
    const workflow = readFileSync(".github/workflows/loop-engineering.yml", "utf8");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("schedule:");
    expect(workflow).toContain('cron: "17 */2 * * *"');
    expect(workflow).toContain("npm ci");
    expect(workflow).toContain("npx playwright install --with-deps chromium");
    expect(workflow).toContain("npm run loop-engineering:detect");
    expect(workflow).toContain("npm run loop-engineering:repair:auto");
    expect(workflow).toContain("git push origin HEAD:main");
    expect(workflow).toContain("actions/upload-artifact@v4");
    expect(workflow).toContain("LOOP_ENGINEERING_AUTH_REQUIRED: \"1\"");
    expect(workflow).toContain("LOOP_ENGINEERING_SENTRY_REQUIRED: \"1\"");
    expect(workflow).not.toContain("wrangler pages deploy");
  });
});
