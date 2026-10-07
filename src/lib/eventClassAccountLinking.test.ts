import { describe, expect, it } from "vitest";
import { resolveUniqueEventClassAccount } from "./eventClassAccountLinking";

describe("resolveUniqueEventClassAccount", () => {
  it("links a legacy class when the expert has one account", () => {
    expect(resolveUniqueEventClassAccount(
      { id: "class-1", expert_id: "expert-1", expert_name: "Ranniely", ad_account_id: null },
      [{ expert_id: "expert-1", ad_account_id: "account-1" }],
    )).toBe("account-1");
  });

  it("leaves a class untouched when the expert has multiple accounts", () => {
    expect(resolveUniqueEventClassAccount(
      { id: "class-1", expert_id: "expert-1", expert_name: "Ranniely", ad_account_id: null },
      [
        { expert_id: "expert-1", ad_account_id: "account-1" },
        { expert_id: "expert-1", ad_account_id: "account-2" },
      ],
    )).toBeNull();
  });

  it("can resolve by the exact expert name when the id is missing", () => {
    expect(resolveUniqueEventClassAccount(
      { id: "class-1", expert_id: null, expert_name: "  RANNIELY " },
      [{ expert_id: "expert-1", ad_account_id: "account-1" }],
      [{ id: "expert-1", nome: "Ranniely" }],
    )).toBe("account-1");
  });

  it("does not overwrite an existing account", () => {
    expect(resolveUniqueEventClassAccount(
      { id: "class-1", expert_id: "expert-1", ad_account_id: "account-existing" },
      [{ expert_id: "expert-1", ad_account_id: "account-1" }],
    )).toBeNull();
  });
});
