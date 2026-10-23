import { describe, expect, it } from "vitest";
import { campaignLoadState } from "./campaignLoading";

describe("campaignLoadState", () => {
  it("não trata uma resposta ainda pendente como lista vazia", () => {
    expect(campaignLoadState({ isLoading: true, isFetching: true, hasData: false, hasError: false })).toBe("loading");
    expect(campaignLoadState({ isLoading: false, isFetching: true, hasData: false, hasError: false })).toBe("loading");
    expect(campaignLoadState({ isLoading: false, isFetching: false, hasData: true, hasError: false })).toBe("ready");
    expect(campaignLoadState({ isLoading: false, isFetching: false, hasData: false, hasError: false })).toBe("empty");
    expect(campaignLoadState({ isLoading: false, isFetching: false, hasData: false, hasError: true })).toBe("error");
  });
});
