import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sdrBundle = readFileSync(
  fileURLToPath(new URL("../../public/agente-sdr/assets/index-bff7dac1.js", import.meta.url)),
  "utf8",
);

describe("SDR connection-scoped inbox contract", () => {
  it("keeps the connection selector and defaults it to a real WhatsApp connection", () => {
    expect(sdrBundle).toContain("whatsApps:connections=[]");
    expect(sdrBundle).toContain("connections.find(A=>String(A.status).toUpperCase()===\"CONNECTED\"&&A.isDefault)||connections.find(A=>String(A.status).toUpperCase()===\"CONNECTED\")");
    expect(sdrBundle).toContain("Selecione uma conexão");
  });

  it("passes the selected WhatsApp id to every ticket view", () => {
    expect(sdrBundle).toContain("inboxFilter:s,whatsappId:q");
    expect(sdrBundle.match(/c\.createElement\(yi,\{connectionId:connectionId/g)).toHaveLength(6);
  });

  it("filters realtime tickets by the selected WhatsApp id", () => {
    expect(sdrBundle).toContain("q&&String(b.whatsappId)===String(q)");
    expect(sdrBundle).toContain("filteredTickets=q?p.filter(O=>String(O.whatsappId)===String(q)):[]");
  });
});
