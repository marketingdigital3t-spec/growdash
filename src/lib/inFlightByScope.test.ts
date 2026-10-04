import { describe, expect, it } from "vitest";
import { withInFlightScope } from "./inFlightByScope";

describe("withInFlightScope", () => {
  it("coalesces duplicate requests for the same scope", async () => {
    const pending = new Map<string, Promise<string>>();
    let calls = 0;
    let release!: (value: string) => void;
    const run = () => {
      calls += 1;
      return new Promise<string>((resolve) => { release = resolve; });
    };

    const first = withInFlightScope(pending, "account-a:today", run);
    const duplicate = withInFlightScope(pending, "account-a:today", run);
    await Promise.resolve();
    expect(calls).toBe(1);
    release("done");
    await expect(Promise.all([first, duplicate])).resolves.toEqual(["done", "done"]);
    expect(pending.has("account-a:today")).toBe(false);
  });

  it("runs a newly selected account while another scope is still pending", async () => {
    const pending = new Map<string, Promise<string>>();
    const first = withInFlightScope(pending, "account-a:today", () => new Promise<string>(() => {}));
    const second = withInFlightScope(pending, "account-b:today", async () => "account-b");

    await expect(second).resolves.toBe("account-b");
    expect(pending.has("account-a:today")).toBe(true);
    expect(pending.has("account-b:today")).toBe(false);
    void first;
  });

  it("releases a failed scope so a later attempt can retry", async () => {
    const pending = new Map<string, Promise<string>>();
    await expect(withInFlightScope(pending, "account-a:today", async () => { throw new Error("fail"); }))
      .rejects.toThrow("fail");
    await expect(withInFlightScope(pending, "account-a:today", async () => "retry"))
      .resolves.toBe("retry");
  });
});
