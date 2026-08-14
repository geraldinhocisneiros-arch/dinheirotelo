import { useFinanceStore } from "@/store/useFinanceStore";
import { Card, ProgressBar } from "@/components/ui";
import { formatBRL, formatDateBR } from "@/lib/format";
import {
  accountBalance,
  categorySpendInMonth,
  monthIncomeExpense,
} from "@/lib/selectors";
import { currentYearMonth, faturaYearMonth, formatYearMonth } from "@/lib/fatura";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";

export function Dashboard() {
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const budgets = useFinanceStore((s) => s.budgets);
  const faturaPayments = useFinanceStore((s) => s.faturaPayments);

  const ym = currentYearMonth();
  const balance = accountBalance(transactions);
  const { income, expense } = monthIncomeExpense(transactions, ym);

  const cardPurchases = transactions.filter(
    (t) => t.paymentMethod === "credit_card" && faturaYearMonth(t.date) === ym,
  );
  const cardTotal = cardPurchases.reduce((s, t) => s + t.amount, 0);
  const faturaPaid = faturaPayments.find((f) => f.yearMonth === ym)?.paid ?? false;

  const recent = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Painel</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm mb-1">
            <Wallet size={16} /> Saldo em conta
          </div>
          <div className="text-2xl font-semibold">{formatBRL(balance)}</div>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm mb-1">
            <TrendingUp size={16} className="text-[var(--income)]" /> Entradas do mês
          </div>
          <div className="text-2xl font-semibold text-[var(--income)]">
            {formatBRL(income)}
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm mb-1">
            <TrendingDown size={16} className="text-[var(--expense)]" /> Saídas do mês
          </div>
          <div className="text-2xl font-semibold text-[var(--expense)]">
            {formatBRL(expense)}
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-[var(--text-muted)]">
            Fatura {faturaPaid ? "paga" : "em aberto"} ({formatYearMonth(ym)})
          </span>
          <span
            className={
              faturaPaid
                ? "font-semibold text-[var(--income)]"
                : "font-semibold text-[var(--card)]"
            }
          >
            {formatBRL(cardTotal)}
          </span>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Compras no cartão até o dia 8 entram nessa fatura; a partir do dia 9,
          vão para a fatura do mês seguinte. Veja detalhes em "Fatura do Cartão".
        </p>
      </Card>

      {budgets.length > 0 && (
        <Card>
          <h2 className="font-medium mb-3">Orçamentos do mês</h2>
          <div className="space-y-3">
            {budgets.map((b) => {
              const cat = categoryById[b.categoryId];
              const spent = categorySpendInMonth(transactions, b.categoryId, ym);
              const left = b.monthlyLimit - spent;
              return (
                <div key={b.categoryId}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{cat?.name ?? "Categoria"}</span>
                    <span className="text-[var(--text-muted)]">
                      {formatBRL(spent)} / {formatBRL(b.monthlyLimit)}
                      {" · "}
                      <span
                        className={
                          left >= 0 ? "text-[var(--income)]" : "text-[var(--expense)]"
                        }
                      >
                        {left >= 0 ? `sobra ${formatBRL(left)}` : `excedeu ${formatBRL(-left)}`}
                      </span>
                    </span>
                  </div>
                  <ProgressBar value={spent} max={b.monthlyLimit} />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="font-medium mb-3">Últimos lançamentos</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            Nenhum lançamento ainda.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {recent.map((t) => (
              <li key={t.id} className="py-2 flex justify-between text-sm">
                <div>
                  <div>{t.description}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {formatDateBR(t.date)} · {categoryById[t.categoryId]?.name}
                    {t.paymentMethod === "credit_card" ? " · cartão" : ""}
                  </div>
                </div>
                <div
                  className={
                    t.type === "income"
                      ? "text-[var(--income)] font-medium"
                      : "text-[var(--expense)] font-medium"
                  }
                >
                  {t.type === "income" ? "+" : "-"}
                  {formatBRL(t.amount)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
