import { describe, expect, it } from "vitest";
import { isWahaSelfMessage } from "../../supabase/functions/_shared/whatsappMessage";

describe("WAHA message origin", () => {
  it("ignores explicit self messages from the provider", () => {
    expect(isWahaSelfMessage({ from: "5511999999999@c.us", fromMe: true }, "5511999999999@c.us")).toBe(true);
    expect(isWahaSelfMessage({ _data: { id: { fromMe: true } } }, "5511999999999@c.us")).toBe(true);
  });

  it("recognizes the session number even when the provider omits fromMe", () => {
    expect(isWahaSelfMessage({ from: "5511999999999@c.us" }, "5511999999999@c.us")).toBe(true);
  });

  it("keeps messages from contacts as inbound", () => {
    expect(isWahaSelfMessage({ from: "5511888888888@c.us", fromMe: false }, "5511999999999@c.us")).toBe(false);
  });
});
