import { useState } from "react";
import { useFinanceStore } from "@/store/useFinanceStore";
import { Card, ProgressBar } from "@/components/ui";
import { MonthSelector } from "@/components/MonthSelector";
import { formatBRL, formatDateBR, todayIso } from "@/lib/format";
import {
  accountBalanceSettled,
  categorySpendInMonth,
  creditCardTransactionsByFatura,
  monthIncomeExpense,
  openFaturasUpTo,
  pendingBudgetInMonth,
  pendingFaturaInMonth,
  pendingRecurringInMonth,
  projectedBalance,
  transactionsInMonth,
  unsettledAccountTransactionsUpTo,
} from "@/lib/selectors";
import { currentYearMonth, formatYearMonth } from "@/lib/fatura";
import { TrendingUp, TrendingDown, Wallet, Sparkles, Check, Circle } from "lucide-react";

export function Dashboard() {
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const budgets = useFinanceStore((s) => s.budgets);
  const faturaPayments = useFinanceStore((s) => s.faturaPayments);
  const recurringTemplates = useFinanceStore((s) => s.recurringTemplates);
  const setTransactionSettled = useFinanceStore((s) => s.setTransactionSettled);

  const [ym, setYm] = useState(currentYearMonth());
  const today = todayIso();
  const currentBalance = accountBalanceSettled(transactions);
  const { income, expense } = monthIncomeExpense(transactions, ym);
  const pendingRecurring = pendingRecurringInMonth(recurringTemplates, transactions, ym);
  const projected = projectedBalance(
    transactions,
    recurringTemplates,
    budgets,
    faturaPayments,
    ym,
  );
  const pendingBudget = pendingBudgetInMonth(transactions, budgets, ym);
  const pendingFatura = pendingFaturaInMonth(transactions, faturaPayments, ym);
  const expenseWithFatura = expense + pendingFatura;
  const openFaturas = openFaturasUpTo(transactions, faturaPayments, ym);
  const unsettledAccount = [...unsettledAccountTransactionsUpTo(transactions, ym)].sort(
    (a, b) => a.date.localeCompare(b.date),
  );

  const cardPurchases = creditCardTransactionsByFatura(transactions).get(ym) ?? [];
  const cardTotal = cardPurchases.reduce((s, t) => s + t.amount, 0);
  const faturaPaid = faturaPayments.find((f) => f.yearMonth === ym)?.paid ?? false;

  // Compras no cartao ja aparecem resumidas no card "Fatura em aberto" acima -
  // aqui ficam so os lancamentos de conta, pra nao repetir o mesmo valor.
  const monthTransactions = transactionsInMonth(transactions, ym)
    .filter((t) => t.paymentMethod !== "credit_card")
    .sort((a, b) => b.date.localeCompare(a.date));

  const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Painel</h1>
        <MonthSelector value={ym} onChange={setYm} />
      </div>

      <div
        className="rounded-xl p-4"
        style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
      >
        <div className="flex items-center gap-2 text-sm mb-1" style={{ opacity: 0.85 }}>
          <Wallet size={16} /> Saldo atual (hoje, {formatDateBR(today)})
        </div>
        <div className="text-3xl font-semibold">{formatBRL(currentBalance)}</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm mb-1">
            <Sparkles size={16} className="text-[var(--accent)]" /> Projeção fim do mês
          </div>
          <div
            className={
              projected >= 0
                ? "text-2xl font-semibold text-[var(--income)]"
                : "text-2xl font-semibold text-[var(--expense)]"
            }
          >
            {formatBRL(projected)}
          </div>
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
            {formatBRL(expenseWithFatura)}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="font-medium mb-3">
          De onde vem a projeção de {formatYearMonth(ym)}
        </h2>
        <ul className="text-sm divide-y divide-[var(--border)]">
          <li className="py-1.5 flex items-center justify-between gap-3">
            <span>Saldo atual (hoje, {formatDateBR(today)})</span>
            <span className="font-medium shrink-0">{formatBRL(currentBalance)}</span>
          </li>
          {unsettledAccount.map((t) => (
            <li key={t.id} className="py-1.5 flex items-center justify-between gap-3">
              <span className="min-w-0 truncate">
                {t.description}{" "}
                <span className="text-[var(--text-muted)]">
                  ({formatDateBR(t.date)}, já lançado, ainda{" "}
                  {t.type === "income" ? "não recebido" : "não pago"})
                </span>
              </span>
              <span
                className={`shrink-0 ${t.type === "income" ? "text-[var(--income)]" : "text-[var(--expense)]"}`}
              >
                {t.type === "income" ? "+" : "-"}
                {formatBRL(t.amount)}
              </span>
            </li>
          ))}
          {pendingRecurring.map((t) => (
            <li key={t.id} className="py-1.5 flex items-center justify-between gap-3">
              <span className="min-w-0 truncate">
                {t.description}{" "}
                <span className="text-[var(--text-muted)]">(recorrente, ainda não lançado)</span>
              </span>
              <span
                className={`shrink-0 ${t.type === "income" ? "text-[var(--income)]" : "text-[var(--expense)]"}`}
              >
                {t.type === "income" ? "+" : "-"}
                {formatBRL(t.amount)}
              </span>
            </li>
          ))}
          {pendingBudget > 0 && (
            <li className="py-1.5 flex items-center justify-between gap-3">
              <span>
                Orçamento ainda não gasto (Feira, Gasolina etc.){" "}
                <span className="text-[var(--text-muted)]">assumido como saída</span>
              </span>
              <span className="text-[var(--expense)] shrink-0">
                -{formatBRL(pendingBudget)}
              </span>
            </li>
          )}
          {openFaturas.map((f) => (
            <li
              key={f.yearMonth}
              className="py-1.5 flex items-center justify-between gap-3"
            >
              <span>
                Fatura do cartão em aberto{" "}
                <span className="text-[var(--text-muted)]">
                  ({formatYearMonth(f.yearMonth)})
                </span>
              </span>
              <span className="text-[var(--expense)] shrink-0">
                -{formatBRL(f.total)}
              </span>
            </li>
          ))}
          <li className="py-1.5 flex items-center justify-between gap-3 font-semibold">
            <span>Projeção fim do mês</span>
            <span
              className={projected >= 0 ? "text-[var(--income)]" : "text-[var(--expense)]"}
            >
              {formatBRL(projected)}
            </span>
          </li>
        </ul>
      </Card>

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
          {!faturaPaid && cardTotal > 0 && (
            <>
              {" "}Enquanto não for marcada como paga, essa fatura já entra nas
              saídas e na projeção de {formatYearMonth(ym)}.
            </>
          )}
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
        <h2 className="font-medium mb-3">
          Lançamentos de {formatYearMonth(ym)}
        </h2>
        {monthTransactions.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            Nenhum lançamento neste mês.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)] max-h-96 overflow-y-auto">
            {monthTransactions.map((t) => (
              <li key={t.id} className="py-2 flex items-center justify-between text-sm gap-3">
                <div className="min-w-0">
                  <div className="truncate">{t.description}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {formatDateBR(t.date)} · {categoryById[t.categoryId]?.name}
                    {t.paymentMethod === "credit_card" ? " · cartão" : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={
                      t.type === "income"
                        ? "text-[var(--income)] font-medium"
                        : "text-[var(--expense)] font-medium"
                    }
                  >
                    {t.type === "income" ? "+" : "-"}
                    {formatBRL(t.amount)}
                  </span>
                  {t.paymentMethod === "account" && (
                    <button
                      onClick={() => setTransactionSettled(t.id, !t.settled)}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${
                        t.settled
                          ? "border-[var(--income)] text-[var(--income)]"
                          : "border-[var(--border)] text-[var(--text-muted)]"
                      }`}
                      title={
                        t.settled
                          ? "Marcar como pendente"
                          : t.type === "income"
                            ? "Marcar como recebido"
                            : "Marcar como pago"
                      }
                    >
                      {t.settled ? <Check size={12} /> : <Circle size={12} />}
                      {t.settled ? "OK" : "Pendente"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
