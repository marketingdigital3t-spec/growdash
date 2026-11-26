import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("combines conditional class names", () => {
    const showHidden = false;
    expect(cn("base", showHidden && "hidden", { active: true })).toBe("base active");
  });

  it("resolves conflicting Tailwind classes", () => {
    expect(cn("px-2 text-sm", "px-4 text-lg")).toBe("px-4 text-lg");
  });
});
