// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RDFunnelsSection } from "./RDFunnelsSection";

const funnels = [
  {
    id: "f1",
    user_id: "u1",
    ad_account_id: null,
    rd_connection_id: "c1",
    name: "Bem - Plano Comercial Franqueados",
    expert_name: null,
    rd_funnel_id: "p1",
    utm_campaign_pattern: null,
    is_active: true,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  },
  {
    id: "f2",
    user_id: "u1",
    ad_account_id: null,
    rd_connection_id: "c1",
    name: "Instituto Palazzo",
    expert_name: null,
    rd_funnel_id: "p2",
    utm_campaign_pattern: null,
    is_active: true,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  },
  {
    id: "f3",
    user_id: "u1",
    ad_account_id: null,
    rd_connection_id: "c1",
    name: "Dra. Natália Barragão - Paciente Modelo",
    expert_name: null,
    rd_funnel_id: "p3",
    utm_campaign_pattern: null,
    is_active: true,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  },
];

vi.mock("@/hooks/useRDFunnels", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useRDFunnels")>("@/hooks/useRDFunnels");
  return {
    ...actual,
    useRDFunnels: () => ({ data: funnels }),
    useCreateRDFunnel: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUpdateRDFunnel: () => ({ mutate: vi.fn(), isPending: false }),
    useDeleteRDFunnel: () => ({ mutate: vi.fn(), isPending: false }),
    useImportRDFunnels: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

vi.mock("@/hooks/useRDAccountConnections", () => ({
  useRDAccountConnections: () => ({
    data: [{ id: "c1", account_name: "Balas de brigadeiro", status: "connected" }],
  }),
}));

vi.mock("@/hooks/useAdAccounts", () => ({
  useAdAccounts: () => ({ data: [] }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// A lista de pipelines do RD vem de uma Edge Function; o teste da busca
// precisa apenas dos vínculos já salvos.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(async () => ({ data: { pipelines: [] }, error: null })),
    },
  },
}));

function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <RDFunnelsSection />
    </QueryClientProvider>,
  );
}

describe("RDFunnelsSection — busca de funis", () => {
  it("lista todos os funis quando nenhuma busca foi digitada", () => {
    renderSection();

    expect(screen.getByText("Bem - Plano Comercial Franqueados")).toBeTruthy();
    expect(screen.getByText("Instituto Palazzo")).toBeTruthy();
    expect(screen.getByText("Dra. Natália Barragão - Paciente Modelo")).toBeTruthy();
  });

  it("filtra os funis conforme o texto digitado", async () => {
    renderSection();

    fireEvent.change(screen.getByLabelText("Buscar funil"), { target: { value: "palazzo" } });

    await waitFor(() => {
      expect(screen.queryByText("Instituto Palazzo")).toBeTruthy();
      expect(screen.queryByText("Bem - Plano Comercial Franqueados")).toBeNull();
      expect(screen.queryByText("Dra. Natália Barragão - Paciente Modelo")).toBeNull();
    });
  });

  it("ignora acentos na busca", async () => {
    renderSection();

    fireEvent.change(screen.getByLabelText("Buscar funil"), { target: { value: "natalia" } });

    await waitFor(() => {
      expect(screen.queryByText("Dra. Natália Barragão - Paciente Modelo")).toBeTruthy();
      expect(screen.queryByText("Instituto Palazzo")).toBeNull();
    });
  });

  it("avisa quando nenhum funil corresponde à busca", async () => {
    renderSection();

    fireEvent.change(screen.getByLabelText("Buscar funil"), { target: { value: "inexistente" } });

    await waitFor(() => {
      expect(screen.getByText("Nenhum funil corresponde à busca.")).toBeTruthy();
    });
  });

  it("mantém o total de funis da conexão durante a busca", async () => {
    renderSection();

    // O cabeçalho do bloco informa quantos funis a conexão tem, não quantos
    // restaram visíveis: a busca não pode reescrever o inventário.
    expect(screen.getByText("3 funil(is) carregado(s) · vincule cada um à conta de anúncio correspondente")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Buscar funil"), { target: { value: "palazzo" } });

    await waitFor(() => {
      expect(screen.getByText("3 funil(is) carregado(s) · vincule cada um à conta de anúncio correspondente")).toBeTruthy();
    });
  });
});
