import { sanitizeOutput } from "./loopEngineeringRedaction";

describe("loop engineering redaction", () => {
  it("redacts authorization and secret values recursively", () => {
    const output = sanitizeOutput({
      headers: { Authorization: "Bearer super-secret", Cookie: "session=private" },
      access_token: "token-value",
      nested: [{ password: "pass-value", message: "safe" }],
      url: "https://example.test/hook?access_token=token-value&ok=1",
    });

    expect(JSON.stringify(output)).not.toContain("super-secret");
    expect(JSON.stringify(output)).not.toContain("private");
    expect(JSON.stringify(output)).not.toContain("token-value");
    expect(JSON.stringify(output)).not.toContain("pass-value");
    expect(output).toMatchObject({ nested: [{ message: "safe" }] });
  });
});
