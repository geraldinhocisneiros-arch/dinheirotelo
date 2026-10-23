import { useState } from "react";
import { useFinanceStore } from "@/store/useFinanceStore";
import { Button, Card, Input, Label, ProgressBar, Select } from "@/components/ui";
import { MonthSelector } from "@/components/MonthSelector";
import { formatBRL } from "@/lib/format";
import { budgetLimitInMonth, categorySpendInMonth } from "@/lib/selectors";
import { currentYearMonth, formatYearMonth } from "@/lib/fatura";
import { Plus, Trash2, X } from "lucide-react";

export function Budgets() {
  const budgets = useFinanceStore((s) => s.budgets);
  const categories = useFinanceStore((s) => s.categories);
  const transactions = useFinanceStore((s) => s.transactions);
  const setBudget = useFinanceStore((s) => s.setBudget);
  const removeBudget = useFinanceStore((s) => s.removeBudget);
  const setBudgetSkipped = useFinanceStore((s) => s.setBudgetSkipped);

  const [showForm, setShowForm] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [limit, setLimit] = useState("");

  const [ym, setYm] = useState(currentYearMonth());
  const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]));
  const expenseCategories = categories.filter((c) => c.type === "expense");
  const availableCategories = expenseCategories.filter(
    (c) => !budgets.some((b) => b.categoryId === c.id),
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(limit);
    if (!categoryId || value <= 0) return;
    setBudget(categoryId, value);
    setCategoryId("");
    setLimit("");
    setShowForm(false);
  }

  const totalLimit = budgets.reduce((s, b) => s + budgetLimitInMonth(b, ym), 0);
  const totalSpent = budgets.reduce(
    (s, b) => s + categorySpendInMonth(transactions, b.categoryId, ym),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Orçamentos</h1>
        <div className="flex items-center gap-3">
          <MonthSelector value={ym} onChange={setYm} />
          <Button onClick={() => setShowForm(true)}>
            <span className="flex items-center gap-1">
              <Plus size={16} /> Novo orçamento
            </span>
          </Button>
        </div>
      </div>
      <p className="text-sm text-[var(--text-muted)]">
        Defina um limite mensal por categoria. A "Projeção fim do mês" no
        Painel já conta o orçamento inteiro como saída desde o dia 1 — o que
        sobrar vira saldo positivo automaticamente, e se você estourar o
        limite, o gasto a mais já pesa no saldo normalmente. Se num mês você
        não vai usar um orçamento, use "Zerar este mês": o limite daquele mês
        vira R$ 0 e o valor volta para a projeção.
      </p>

      {totalLimit > 0 && (
        <Card>
          <div className="flex justify-between text-sm mb-1">
            <span>Total orçado no mês</span>
            <span className="text-[var(--text-muted)]">
              {formatBRL(totalSpent)} / {formatBRL(totalLimit)}
            </span>
          </div>
          <ProgressBar value={totalSpent} max={totalLimit} />
        </Card>
      )}

      {showForm && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">Novo orçamento</h2>
            <button onClick={() => setShowForm(false)} aria-label="Fechar">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
              >
                <option value="">Selecione...</option>
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Limite mensal (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                required
              />
            </div>
            <div className="sm:col-span-2 flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="space-y-3">
        {budgets.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--text-muted)]">
              Nenhum orçamento cadastrado.
            </p>
          </Card>
        ) : (
          budgets.map((b) => {
            const cat = categoryById[b.categoryId];
            const spent = categorySpendInMonth(transactions, b.categoryId, ym);
            const skipped = b.skippedMonths?.includes(ym) ?? false;
            const limit = budgetLimitInMonth(b, ym);
            const left = limit - spent;
            return (
              <Card key={b.categoryId}>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="font-medium">
                    {cat?.name ?? "Categoria"}
                    {skipped && (
                      <span className="text-xs font-normal text-[var(--text-muted)]">
                        {" "}(zerado em {formatYearMonth(ym)}, normal {formatBRL(b.monthlyLimit)})
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => setBudgetSkipped(b.categoryId, ym, !skipped)}
                      className="text-xs text-[var(--text-muted)] underline"
                    >
                      {skipped ? "Reativar este mês" : "Zerar este mês"}
                    </button>
                    <button
                      onClick={() => removeBudget(b.categoryId)}
                      aria-label="Excluir orçamento"
                    >
                      <Trash2 size={15} className="text-[var(--expense)]" />
                    </button>
                  </div>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[var(--text-muted)]">
                    {formatBRL(spent)} de {formatBRL(limit)}
                  </span>
                  <span
                    className={
                      left >= 0 ? "text-[var(--income)]" : "text-[var(--expense)]"
                    }
                  >
                    {left >= 0
                      ? `sobra ${formatBRL(left)} este mês`
                      : `excedeu em ${formatBRL(-left)}`}
                  </span>
                </div>
                <ProgressBar value={spent} max={limit} />
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
