import { useMemo, useRef, useState } from "react";
import { useFinanceStore } from "@/store/useFinanceStore";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { formatBRL, formatDateBR, todayIso } from "@/lib/format";
import { faturaYearMonth, formatYearMonth } from "@/lib/fatura";
import { importTransactionsFromCsv, type ImportResult } from "@/lib/importTransactions";
import type { EntryType, PaymentMethod, Transaction } from "@/lib/types";
import { Trash2, Pencil, Plus, X, Upload } from "lucide-react";

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
  const importTransactions = useFinanceStore((s) => s.importTransactions);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [filterType, setFilterType] = useState<"all" | EntryType>("all");

  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function openImport() {
    setCsvText("");
    setPreview(null);
    setShowImport(true);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    setPreview(importTransactionsFromCsv(text, categories));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleAnalyze() {
    if (!csvText.trim()) return;
    setPreview(importTransactionsFromCsv(csvText, categories));
  }

  function handleConfirmImport() {
    if (!preview || preview.transactions.length === 0) return;
    importTransactions(preview.newCategories, preview.transactions);
    setShowImport(false);
    setCsvText("");
    setPreview(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Lançamentos</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={openImport}>
            <span className="flex items-center gap-1">
              <Upload size={16} /> Importar CSV
            </span>
          </Button>
          <Button onClick={openNew}>
            <span className="flex items-center gap-1">
              <Plus size={16} /> Novo lançamento
            </span>
          </Button>
        </div>
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

      {showImport && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">Importar lançamentos de um CSV</h2>
            <button onClick={() => setShowImport(false)} aria-label="Fechar">
              <X size={18} />
            </button>
          </div>
          <p className="text-sm text-[var(--text-muted)] mb-3">
            Colunas esperadas: data, descrição, valor e, opcionalmente, tipo
            (entrada/saída), categoria e forma de pagamento (conta/cartão).
          </p>
          <div className="flex flex-col gap-3">
            <div>
              <Label>Arquivo CSV</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="text-sm"
              />
            </div>
            <div>
              <Label>Ou cole o conteúdo do CSV aqui</Label>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={6}
                placeholder="data,descricao,valor,tipo,categoria,forma_pagamento"
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={handleAnalyze}>
                Analisar
              </Button>
            </div>

            {preview && (
              <div className="border-t border-[var(--border)] pt-3">
                <p className="text-sm mb-2">
                  <span className="font-medium text-[var(--income)]">
                    {preview.transactions.length} lançamento
                    {preview.transactions.length !== 1 ? "s" : ""}
                  </span>{" "}
                  pronto{preview.transactions.length !== 1 ? "s" : ""} para
                  importar
                  {preview.newCategories.length > 0 && (
                    <>
                      {" "}
                      · {preview.newCategories.length} categoria
                      {preview.newCategories.length !== 1 ? "s" : ""} nova
                      {preview.newCategories.length !== 1 ? "s" : ""} será
                      {preview.newCategories.length !== 1 ? "ão" : ""} criada
                      {preview.newCategories.length !== 1 ? "s" : ""}
                    </>
                  )}
                </p>
                {preview.errors.length > 0 && (
                  <ul className="text-xs text-[var(--expense)] mb-2 space-y-0.5">
                    {preview.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {preview.errors.length > 5 && (
                      <li>e mais {preview.errors.length - 5} erro(s)...</li>
                    )}
                  </ul>
                )}
                {preview.transactions.length > 0 && (
                  <ul className="text-sm divide-y divide-[var(--border)] max-h-48 overflow-y-auto mb-3">
                    {preview.transactions.slice(0, 8).map((t, i) => (
                      <li key={i} className="py-1.5 flex justify-between">
                        <span className="truncate">
                          {formatDateBR(t.date)} · {t.description}
                        </span>
                        <span
                          className={
                            t.type === "income"
                              ? "text-[var(--income)]"
                              : "text-[var(--expense)]"
                          }
                        >
                          {formatBRL(t.amount)}
                        </span>
                      </li>
                    ))}
                    {preview.transactions.length > 8 && (
                      <li className="py-1.5 text-[var(--text-muted)]">
                        e mais {preview.transactions.length - 8}...
                      </li>
                    )}
                  </ul>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setShowImport(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleConfirmImport}
                    disabled={preview.transactions.length === 0}
                  >
                    Confirmar importação
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

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
