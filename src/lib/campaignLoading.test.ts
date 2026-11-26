import { describe, expect, it } from "vitest";
import { campaignDisplayState, campaignLoadState } from "./campaignLoading";

describe("campaignLoadState", () => {
  it("não trata uma resposta ainda pendente como lista vazia", () => {
    expect(campaignLoadState({ isLoading: true, isFetching: true, hasData: false, hasError: false })).toBe("loading");
    expect(campaignLoadState({ isLoading: false, isFetching: true, hasData: false, hasError: false })).toBe("loading");
    expect(campaignLoadState({ isLoading: true, isFetching: true, hasData: false, hasError: false, timedOut: true })).toBe("loading");
    expect(campaignLoadState({ isLoading: false, isFetching: false, hasData: true, hasError: false })).toBe("ready");
    expect(campaignLoadState({ isLoading: false, isFetching: false, hasData: false, hasError: false })).toBe("empty");
    expect(campaignLoadState({ isLoading: false, isFetching: false, hasData: false, hasError: true })).toBe("error");
    expect(campaignLoadState({ isLoading: false, isFetching: false, hasData: false, hasError: false, timedOut: true })).toBe("error");
  });

  it("libera a tela após o prazo visual sem cancelar a atualização", () => {
    expect(campaignDisplayState({ pending: true, hasSnapshot: false, visualTimedOut: true, hasError: false })).toBe("background");
    expect(campaignDisplayState({ pending: true, hasSnapshot: true, visualTimedOut: true, hasError: false })).toBe("ready");
    expect(campaignDisplayState({ pending: true, hasSnapshot: false, visualTimedOut: false, hasError: false })).toBe("loading");
    expect(campaignDisplayState({ pending: false, hasSnapshot: false, visualTimedOut: false, hasError: true })).toBe("error");
  });
});
