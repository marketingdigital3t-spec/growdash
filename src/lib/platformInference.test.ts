import { describe, expect, it } from "vitest";
import { inferPlatform } from "./platformInference";

describe("platform inference", () => {
  it("attributes RD traffic-paid origin to Meta", () => {
    expect(inferPlatform({ utm_source: "Tráfego Pago" }, []).platform).toBe("meta");
  });

  it("keeps Meta attribution for accent-free traffic-paid origin", () => {
    expect(inferPlatform({ rd_campaign_name: "Trafego Pago" }, []).platform).toBe("meta");
  });
});
