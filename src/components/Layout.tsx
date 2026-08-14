import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowLeftRight,
  CreditCard,
  Repeat,
  PiggyBank,
  BarChart3,
  Wallet,
} from "lucide-react";

const links = [
  { to: "/", label: "Painel", icon: LayoutDashboard, end: true },
  { to: "/lancamentos", label: "Lançamentos", icon: ArrowLeftRight },
  { to: "/fatura", label: "Fatura do Cartão", icon: CreditCard },
  { to: "/recorrentes", label: "Recorrentes", icon: Repeat },
  { to: "/orcamentos", label: "Orçamentos", icon: PiggyBank },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
];

export function Layout() {
  return (
    <div className="min-h-svh flex flex-col md:flex-row">
      <aside className="md:w-60 shrink-0 border-b md:border-b-0 md:border-r border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center gap-2 px-5 py-4">
          <Wallet className="text-[var(--accent)]" size={22} />
          <span className="font-semibold text-lg">Finanças de Casa</span>
        </div>
        <nav className="flex md:flex-col overflow-x-auto md:overflow-visible px-2 pb-2 md:pb-4 gap-1">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--bg)]"
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 min-w-0 p-4 md:p-8 max-w-5xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
