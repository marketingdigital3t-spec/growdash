import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Home from "@/pages/Home";
import Placeholder from "@/pages/Placeholder";
import AgendaSemana from "@/pages/agenda/Agenda";
import AgendaVisaoGeral from "@/pages/agenda/VisaoGeral";
import RelatorioAgendamentos from "@/pages/agenda/RelatorioAgendamentos";
import Eventos from "@/pages/agenda/Eventos";
import { NAV } from "@/nav/nav-config";

const built = new Set<string>(["/", "/agenda/semana", "/agenda/visao-geral", "/agenda/relatorio-agendamentos", "/agenda/eventos"]);

const placeholderRoutes = NAV.flatMap((n) => {
  const list: string[] = [];
  if (n.path !== "/") list.push(n.path);
  n.submenu?.forEach((s) => list.push(s.path));
  return list;
}).filter((p) => !built.has(p));

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/agenda/semana" element={<AgendaSemana />} />
        <Route path="/agenda/visao-geral" element={<AgendaVisaoGeral />} />
        <Route path="/agenda/relatorio-agendamentos" element={<RelatorioAgendamentos />} />
        <Route path="/agenda/eventos" element={<Eventos />} />
        {placeholderRoutes.map((p) => (
          <Route key={p} path={p} element={<Placeholder />} />
        ))}
        <Route path="*" element={<Placeholder />} />
      </Route>
    </Routes>
  </BrowserRouter>
);

export default App;
