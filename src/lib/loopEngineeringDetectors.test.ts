import { detectCommandFailure, detectDataAvailabilityRegression } from "./loopEngineeringDetectors";

describe("loop engineering detectors", () => {
  it("reports a command timeout without interpreting it as an empty dataset", () => {
    const finding = detectCommandFailure({ command: "npm test", exitCode: null, signal: "SIGTERM", timedOut: true, stdout: "", stderr: "Tempo de carregamento excedido." }, { layer: "backend" });

    expect(finding?.category).toBe("runtime");
    expect(finding?.title).toContain("timeout");
    expect(JSON.stringify(finding?.evidence)).not.toContain('"value":0');
  });

  it("detects a false zero shown while a request is still loading", () => {
    const findings = detectDataAvailabilityRegression("status=loading campaigns=0 timeout=false", { route: "/campanhas" });

    expect(findings).toHaveLength(1);
    expect(findings[0].category).toBe("data_availability");
    expect(findings[0].evidence).toMatchObject({ route: "/campanhas", state: "loading" });
  });
});
