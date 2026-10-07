import { describe, expect, it } from "vitest";
import { getExpertAccountIds, validateSellerAvatarFile } from "@/lib/commercialFilters";

describe("commercial filters", () => {
  it("consolida as contas de vários experts", () => {
    const result = getExpertAccountIds([
      { expertId: "expert-a", adAccountId: "account-1" },
      { expertId: "expert-a", adAccountId: "account-2" },
      { expertId: "expert-b", adAccountId: "account-3" },
    ], ["expert-a", "expert-b"]);
    expect([...result!]).toEqual(["account-1", "account-2", "account-3"]);
  });

  it("retorna null quando nenhum expert está filtrado", () => {
    expect(getExpertAccountIds([{ expertId: "expert-a", adAccountId: "account-1" }], [])).toBeNull();
  });

  it("valida o limite e os formatos do bucket de avatares", () => {
    expect(validateSellerAvatarFile({ type: "image/png", size: 3 * 1024 * 1024 })).toBeNull();
    expect(validateSellerAvatarFile({ type: "image/png", size: 3 * 1024 * 1024 + 1 })).toContain("3 MB");
    expect(validateSellerAvatarFile({ type: "image/gif", size: 10 })).toContain("JPG");
  });
});
