import { describe, expect, it } from "vitest";
import { resumeWorkflow } from "../../../supabase/functions/_shared/workflowResume";

describe("workflow approval resume", () => {
  it("continues from the approved node without rerunning the trigger", () => {
    expect(resumeWorkflow([
      { source: "trigger", target: "approval" },
      { source: "approval", target: "send" },
      { source: "send", target: "end" },
    ], "approval")).toEqual({ queue: ["send"], visited: ["approval"] });
  });
});
