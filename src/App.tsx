import { useEffect } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Dashboard } from "@/pages/Dashboard";
import { Transactions } from "@/pages/Transactions";
import { Fatura } from "@/pages/Fatura";
import { Recurring } from "@/pages/Recurring";
import { Budgets } from "@/pages/Budgets";
import { Reports } from "@/pages/Reports";
import { useFinanceStore } from "@/store/useFinanceStore";

export default function App() {
  const autoLaunchRecurring = useFinanceStore((s) => s.autoLaunchRecurring);

  useEffect(() => {
    autoLaunchRecurring();
  }, [autoLaunchRecurring]);

  return (
    <HashRouter>
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
    </HashRouter>
  );
}
