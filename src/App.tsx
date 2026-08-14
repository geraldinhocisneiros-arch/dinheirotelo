import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Dashboard } from "@/pages/Dashboard";
import { Transactions } from "@/pages/Transactions";
import { Fatura } from "@/pages/Fatura";
import { Recurring } from "@/pages/Recurring";
import { Budgets } from "@/pages/Budgets";
import { Reports } from "@/pages/Reports";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="lancamentos" element={<Transactions />} />
          <Route path="fatura" element={<Fatura />} />
          <Route path="recorrentes" element={<Recurring />} />
          <Route path="orcamentos" element={<Budgets />} />
          <Route path="relatorios" element={<Reports />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
