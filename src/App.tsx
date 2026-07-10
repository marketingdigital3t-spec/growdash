import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Home from "@/pages/Home";
import Placeholder from "@/pages/Placeholder";
import AgendaSemana from "@/pages/agenda/Agenda";
import AgendaVisaoGeral from "@/pages/agenda/VisaoGeral";
import RelatorioAgendamentos from "@/pages/agenda/RelatorioAgendamentos";
import Eventos from "@/pages/agenda/Eventos";
import ChatSeguro from "@/pages/chat/ChatSeguro";
import MinhaConversa from "@/pages/chat/MinhaConversa";
import Recuperacao from "@/pages/chat/Recuperacao";
import SolicitacoesLgpd from "@/pages/admin/SolicitacoesLgpd";


import Login from "@/pages/auth/Login";
import Signup from "@/pages/auth/Signup";
import SetupAdmin from "@/pages/auth/SetupAdmin";
import Usuarios from "@/pages/config/Usuarios";
import Perfil from "@/pages/config/Perfil";
import Clinica from "@/pages/config/Clinica";
import Pacientes from "@/pages/contatos/Pacientes";
import Profissionais from "@/pages/contatos/Profissionais";
import Fornecedores from "@/pages/contatos/Fornecedores";
import Leads from "@/pages/contatos/Leads";
import TodosContatos from "@/pages/contatos/Todos";
import ContatosAniversariantes from "@/pages/contatos/Aniversariantes";
import Frequencia from "@/pages/contatos/Frequencia";
import Mesclar from "@/pages/contatos/Mesclar";
import Convidar from "@/pages/contatos/Convidar";
import AtendimentosListagem from "@/pages/atendimentos/Listagem";
import Atestados from "@/pages/atendimentos/Atestados";
import Guias from "@/pages/atendimentos/Guias";
import VendasLista from "@/pages/vendas/Vendas";
import Orcamentos from "@/pages/vendas/Orcamentos";
import Pacotes from "@/pages/vendas/Pacotes";
import FluxoCaixa from "@/pages/financeiro/FluxoCaixa";
import ContasPagar from "@/pages/financeiro/ContasPagar";
import ContasReceber from "@/pages/financeiro/ContasReceber";
import Extrato from "@/pages/financeiro/Extrato";
import Comissoes from "@/pages/Comissoes";
import Produtos from "@/pages/estoque/Produtos";
import Movimentacoes from "@/pages/estoque/Movimentacoes";
import WhatsApp from "@/pages/comunicacao/WhatsApp";
import Email from "@/pages/comunicacao/Email";
import SMS from "@/pages/comunicacao/SMS";
import Modelos from "@/pages/clinidocs/Modelos";
import Documentos from "@/pages/clinidocs/Documentos";
import Campanhas from "@/pages/marketing/Campanhas";
import MarketingAniversariantes from "@/pages/marketing/Aniversariantes";
import Comunidade from "@/pages/Comunidade";
import ProtectedRoute from "@/components/ProtectedRoute";
import MfaGate from "@/components/MfaGate";
import VaultGate from "@/components/VaultGate";
import { AuthProvider } from "@/hooks/useAuth";
import { CryptoProvider } from "@/hooks/useCrypto";
import { NAV } from "@/nav/nav-config";

const built = new Set<string>([
  "/",
  "/agenda/semana",
  "/agenda/visao-geral",
  "/agenda/relatorio-agendamentos",
  "/agenda/eventos",
  "/chat-seguro",
  "/chat-seguro/recuperacao",
  "/minha-conversa",
  "/admin/lgpd",

  "/config/usuarios",
  "/config/perfil",
  "/config/clinica",
  "/contatos/pacientes",
  "/contatos/profissionais",
  "/contatos/fornecedores",
  "/contatos/leads",
  "/contatos/todos",
  "/contatos/aniversariantes",
  "/contatos/frequencia",
  "/contatos/mesclar",
  "/contatos/convidar",
  "/atendimentos/listagem",
  "/atendimentos/atestados",
  "/atendimentos/guias",
  "/vendas/lista",
  "/vendas/orcamentos",
  "/vendas/pacotes",
  "/financeiro/fluxo-de-caixa",
  "/financeiro/contas-a-pagar",
  "/financeiro/contas-a-receber",
  "/financeiro/extrato",
  "/comissoes",
  "/estoque/produtos",
  "/estoque/movimentacoes",
  "/comunicacao/whatsapp",
  "/comunicacao/email",
  "/comunicacao/sms",
  "/clinidocs/modelos",
  "/clinidocs/documentos",
  "/marketing/campanhas",
  "/marketing/aniversariantes",
  "/comunidade",
]);


const placeholderRoutes = NAV.flatMap((n) => {
  const list: string[] = [];
  if (n.path !== "/") list.push(n.path);
  n.submenu?.forEach((s) => list.push(s.path));
  return list;
}).filter((p) => !built.has(p));

const App = () => (
  <AuthProvider>
    <CryptoProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Signup />} />
          <Route path="/setup-admin" element={<SetupAdmin />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/agenda/semana" element={<AgendaSemana />} />
            <Route path="/agenda/visao-geral" element={<AgendaVisaoGeral />} />
            <Route path="/agenda/relatorio-agendamentos" element={<RelatorioAgendamentos />} />
            <Route path="/agenda/eventos" element={<Eventos />} />
            <Route
              path="/chat-seguro"
              element={
                <ProtectedRoute allow={["admin", "professional"]} fallback="/minha-conversa">
                  <MfaGate>
                    <VaultGate>
                      <ChatSeguro />
                    </VaultGate>
                  </MfaGate>
                </ProtectedRoute>
              }
            />
            <Route
              path="/minha-conversa"
              element={
                <ProtectedRoute>
                  <VaultGate>
                    <MinhaConversa />
                  </VaultGate>
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat-seguro/recuperacao"
              element={
                <ProtectedRoute allow={["admin"]}>
                  <MfaGate>
                    <VaultGate>
                      <Recuperacao />
                    </VaultGate>
                  </MfaGate>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/lgpd"
              element={
                <ProtectedRoute allow={["admin"]}>
                  <MfaGate>
                    <SolicitacoesLgpd />
                  </MfaGate>
                </ProtectedRoute>
              }
            />


            <Route
              path="/config/usuarios"
              element={
                <ProtectedRoute>
                  <MfaGate>
                    <Usuarios />
                  </MfaGate>
                </ProtectedRoute>
              }
            />
            <Route path="/config/perfil" element={<ProtectedRoute><Perfil /></ProtectedRoute>} />
            <Route path="/config/clinica" element={<ProtectedRoute><Clinica /></ProtectedRoute>} />
            <Route path="/contatos/pacientes" element={<Pacientes />} />
            <Route path="/contatos/profissionais" element={<Profissionais />} />
            <Route path="/contatos/fornecedores" element={<Fornecedores />} />
            <Route path="/contatos/leads" element={<Leads />} />
            <Route path="/contatos/todos" element={<TodosContatos />} />
            <Route path="/contatos/aniversariantes" element={<ContatosAniversariantes />} />
            <Route path="/contatos/frequencia" element={<Frequencia />} />
            <Route path="/contatos/mesclar" element={<Mesclar />} />
            <Route path="/contatos/convidar" element={<Convidar />} />
            <Route path="/atendimentos/listagem" element={<AtendimentosListagem />} />
            <Route path="/atendimentos/atestados" element={<Atestados />} />
            <Route path="/atendimentos/guias" element={<Guias />} />
            <Route path="/vendas/lista" element={<VendasLista />} />
            <Route path="/vendas/orcamentos" element={<Orcamentos />} />
            <Route path="/vendas/pacotes" element={<Pacotes />} />
            <Route path="/financeiro/fluxo-de-caixa" element={<FluxoCaixa />} />
            <Route path="/financeiro/contas-a-pagar" element={<ContasPagar />} />
            <Route path="/financeiro/contas-a-receber" element={<ContasReceber />} />
            <Route path="/financeiro/extrato" element={<Extrato />} />
            <Route path="/comissoes" element={<Comissoes />} />
            <Route path="/estoque/produtos" element={<Produtos />} />
            <Route path="/estoque/movimentacoes" element={<Movimentacoes />} />
            <Route path="/comunicacao/whatsapp" element={<WhatsApp />} />
            <Route path="/comunicacao/email" element={<Email />} />
            <Route path="/comunicacao/sms" element={<SMS />} />
            <Route path="/clinidocs/modelos" element={<Modelos />} />
            <Route path="/clinidocs/documentos" element={<Documentos />} />
            <Route path="/marketing/campanhas" element={<Campanhas />} />
            <Route path="/marketing/aniversariantes" element={<MarketingAniversariantes />} />
            <Route path="/comunidade" element={<Comunidade />} />

            {placeholderRoutes.map((p) => (
              <Route key={p} path={p} element={<Placeholder />} />
            ))}
            <Route path="*" element={<Placeholder />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </CryptoProvider>
  </AuthProvider>
);

export default App;
