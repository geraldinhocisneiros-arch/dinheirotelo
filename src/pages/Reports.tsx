import { useMemo, useState } from "react";
import { useFinanceStore } from "@/store/useFinanceStore";
import { Card } from "@/components/ui";
import { MonthSelector } from "@/components/MonthSelector";
import { formatBRL } from "@/lib/format";
import { currentYearMonth, formatYearMonth } from "@/lib/fatura";

function brlFormatter(value: unknown) {
  return formatBRL(Number(Array.isArray(value) ? value[0] : value));
}
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function Reports() {
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]));

  const [categoryMonth, setCategoryMonth] = useState(currentYearMonth());

  const spendByCategory = useMemo(() => {
    const totals = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== "expense") continue;
      if (t.date.slice(0, 7) !== categoryMonth) continue;
      totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount);
    }
    return [...totals.entries()]
      .map(([categoryId, value]) => ({
        name: categoryById[categoryId]?.name ?? "Outros",
        value,
        color: categoryById[categoryId]?.color ?? "#999",
      }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, categoryMonth, categoryById]);

  const monthlyTrend = useMemo(() => {
    const totals = new Map<string, { income: number; expense: number }>();
    for (const t of transactions) {
      if (t.paymentMethod !== "account") continue;
      const key = t.date.slice(0, 7);
      const entry = totals.get(key) ?? { income: 0, expense: 0 };
      if (t.type === "income") entry.income += t.amount;
      else entry.expense += t.amount;
      totals.set(key, entry);
    }
    return [...totals.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, ...v }));
  }, [transactions]);

  const trendChartWidth = Math.max(560, monthlyTrend.length * 70);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Relatórios</h1>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="font-medium">Gastos por categoria</h2>
          <MonthSelector value={categoryMonth} onChange={setCategoryMonth} />
        </div>
        {spendByCategory.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            Sem gastos em {formatYearMonth(categoryMonth)}.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4 items-center">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={spendByCategory}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {spendByCategory.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={brlFormatter} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="space-y-2 text-sm">
              {spendByCategory.map((c) => (
                <li key={c.name} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: c.color }}
                    />
                    {c.name}
                  </span>
                  <span className="text-[var(--text-muted)]">
                    {formatBRL(c.value)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-medium mb-3">Entradas x Saídas por mês</h2>
        {monthlyTrend.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Sem dados ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: trendChartWidth }}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip formatter={brlFormatter} />
                  <Bar dataKey="income" name="Entradas" fill="var(--income)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Saídas" fill="var(--expense)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-medium mb-3">Saldo mensal</h2>
        {monthlyTrend.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Sem dados ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: trendChartWidth }}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={monthlyTrend.map((m) => ({
                    month: m.month,
                    saldo: m.income - m.expense,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip formatter={brlFormatter} />
                  <Line
                    type="monotone"
                    dataKey="saldo"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    dot
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
