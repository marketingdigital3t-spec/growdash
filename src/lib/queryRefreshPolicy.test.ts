import { describe, expect, it } from "vitest";
import { shouldRefetchSnapshotOnMount } from "./queryRefreshPolicy";

describe("política de revalidação dos snapshots", () => {
  it("não refaz a leitura pesada ao montar quando já há snapshot persistido", () => {
    expect(shouldRefetchSnapshotOnMount(true)).toBe(false);
  });

  it("faz a primeira leitura quando ainda não existe snapshot", () => {
    expect(shouldRefetchSnapshotOnMount(false)).toBe(true);
  });
});
