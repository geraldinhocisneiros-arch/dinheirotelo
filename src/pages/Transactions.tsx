import { useMemo, useState } from "react";
import { useFinanceStore } from "@/store/useFinanceStore";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { formatBRL, formatDateBR, todayIso } from "@/lib/format";
import { faturaYearMonth, formatYearMonth } from "@/lib/fatura";
import type { EntryType, PaymentMethod, Transaction } from "@/lib/types";
import { Trash2, Pencil, Plus, X } from "lucide-react";

type FormState = Omit<Transaction, "id">;

const emptyForm = (): FormState => ({
  date: todayIso(),
  description: "",
  amount: 0,
  type: "expense",
  categoryId: "",
  paymentMethod: "account",
});

export function Transactions() {
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const updateTransaction = useFinanceStore((s) => s.updateTransaction);
  const removeTransaction = useFinanceStore((s) => s.removeTransaction);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [filterType, setFilterType] = useState<"all" | EntryType>("all");

  const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]));
  const categoriesForType = categories.filter((c) => c.type === form.type);

  const sorted = useMemo(
    () =>
      [...transactions]
        .filter((t) => filterType === "all" || t.type === filterType)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, filterType],
  );

  function openNew() {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(t: Transaction) {
    const { id, ...rest } = t;
    setForm(rest);
    setEditingId(id);
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description.trim() || form.amount <= 0 || !form.categoryId) return;
    if (editingId) {
      updateTransaction(editingId, form);
    } else {
      addTransaction(form);
    }
    setShowForm(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Lançamentos</h1>
        <Button onClick={openNew}>
          <span className="flex items-center gap-1">
            <Plus size={16} /> Novo lançamento
          </span>
        </Button>
      </div>

      <div className="flex gap-2">
        {(["all", "income", "expense"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilterType(f)}
            className={`px-3 py-1.5 rounded-full text-sm border ${
              filterType === f
                ? "bg-[var(--accent)] text-[var(--accent-fg)] border-[var(--accent)]"
                : "border-[var(--border)] text-[var(--text-muted)]"
            }`}
          >
            {f === "all" ? "Todos" : f === "income" ? "Entradas" : "Saídas"}
          </button>
        ))}
      </div>

      {showForm && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">
              {editingId ? "Editar lançamento" : "Novo lançamento"}
            </h2>
            <button onClick={() => setShowForm(false)} aria-label="Fechar">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select
                value={form.type}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    type: e.target.value as EntryType,
                    categoryId: "",
                  }))
                }
              >
                <option value="expense">Saída</option>
                <option value="income">Entrada</option>
              </Select>
            </div>
            <div>
              <Label>Forma de pagamento</Label>
              <Select
                value={form.paymentMethod}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    paymentMethod: e.target.value as PaymentMethod,
                  }))
                }
                disabled={form.type === "income"}
              >
                <option value="account">Conta / Débito</option>
                <option value="credit_card">Cartão de crédito</option>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Descrição</Label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Ex: Supermercado, Salário, Uber..."
                required
              />
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={form.amount || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: Number(e.target.value) }))
                }
                required
              />
            </div>
            <div>
              <Label>Data</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Categoria</Label>
              <Select
                value={form.categoryId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, categoryId: e.target.value }))
                }
                required
              >
                <option value="">Selecione...</option>
                {categoriesForType.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            {form.paymentMethod === "credit_card" && form.date && (
              <p className="sm:col-span-2 text-xs text-[var(--text-muted)]">
                Vai para a fatura de {formatYearMonth(faturaYearMonth(form.date))}.
              </p>
            )}
            <div className="sm:col-span-2 flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        {sorted.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            Nenhum lançamento encontrado.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {sorted.map((t) => (
              <li key={t.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate">{t.description}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {formatDateBR(t.date)} · {categoryById[t.categoryId]?.name}
                    {t.paymentMethod === "credit_card" ? " · cartão" : " · conta"}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
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
                  <button onClick={() => openEdit(t)} aria-label="Editar">
                    <Pencil size={15} className="text-[var(--text-muted)]" />
                  </button>
                  <button onClick={() => removeTransaction(t.id)} aria-label="Excluir">
                    <Trash2 size={15} className="text-[var(--expense)]" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
