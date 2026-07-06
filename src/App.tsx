import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Home from "@/pages/Home";

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  </BrowserRouter>
);

export default App;
