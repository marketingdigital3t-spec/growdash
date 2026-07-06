import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Home from "@/pages/Home";
import Placeholder from "@/pages/Placeholder";
import { NAV } from "@/nav/nav-config";

const routes = NAV.flatMap((n) => {
  const list: { path: string }[] = [];
  if (n.path !== "/") list.push({ path: n.path });
  n.submenu?.forEach((s) => list.push({ path: s.path }));
  return list;
});

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        {routes.map((r) => (
          <Route key={r.path} path={r.path} element={<Placeholder />} />
        ))}
        <Route path="*" element={<Placeholder />} />
      </Route>
    </Routes>
  </BrowserRouter>
);

export default App;
