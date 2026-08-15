import { useMemo, useRef, useState } from "react";
import { useFinanceStore } from "@/store/useFinanceStore";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { formatBRL, todayIso } from "@/lib/format";
import {
  importRecurringFromCsv,
  type RecurringImportResult,
} from "@/lib/importRecurring";
import { findDuplicateRecurringTemplates } from "@/lib/selectors";
import type { EntryType, PaymentMethod, RecurringTemplate } from "@/lib/types";
import { Plus, Trash2, Pencil, X, PlayCircle, Upload, AlertTriangle } from "lucide-react";

type FormState = Omit<RecurringTemplate, "id">;

const emptyForm = (): FormState => ({
  description: "",
  amount: 0,
  type: "expense",
  categoryId: "",
  paymentMethod: "account",
  dayOfMonth: 5,
  active: true,
});

export function Recurring() {
  const templates = useFinanceStore((s) => s.recurringTemplates);
  const categories = useFinanceStore((s) => s.categories);
  const addRecurringTemplate = useFinanceStore((s) => s.addRecurringTemplate);
  const updateRecurringTemplate = useFinanceStore(
    (s) => s.updateRecurringTemplate,
  );
  const removeRecurringTemplate = useFinanceStore(
    (s) => s.removeRecurringTemplate,
  );
  const launchRecurring = useFinanceStore((s) => s.launchRecurring);
  const importRecurringTemplates = useFinanceStore((s) => s.importRecurringTemplates);
  const removeDuplicateRecurring = useFinanceStore((s) => s.removeDuplicateRecurring);
  const transactions = useFinanceStore((s) => s.transactions);

  const duplicateGroups = useMemo(
    () => findDuplicateRecurringTemplates(templates),
    [templates],
  );
  const [dedupeResult, setDedupeResult] = useState<{
    removedTemplates: number;
    removedTransactions: number;
  } | null>(null);

  function handleRemoveDuplicates() {
    const result = removeDuplicateRecurring();
    setDedupeResult(result);
  }

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<RecurringImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]));
  const categoriesForType = categories.filter((c) => c.type === form.type);
  const currentMonth = todayIso().slice(0, 7);

  function openNew() {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(t: RecurringTemplate) {
    const { id, ...rest } = t;
    setForm(rest);
    setEditingId(id);
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description.trim() || form.amount <= 0 || !form.categoryId) return;
    if (editingId) {
      updateRecurringTemplate(editingId, form);
    } else {
      addRecurringTemplate(form);
    }
    setShowForm(false);
  }

  function launchedThisMonth(templateId: string) {
    return transactions.some(
      (t) =>
        t.recurringTemplateId === templateId &&
        t.date.slice(0, 7) === currentMonth,
    );
  }

  function handleLaunch(templateId: string) {
    const day = templates.find((t) => t.id === templateId)?.dayOfMonth ?? 1;
    const date = `${currentMonth}-${String(day).padStart(2, "0")}`;
    launchRecurring(templateId, date);
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
    setPreview(importRecurringFromCsv(text, categories));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleAnalyze() {
    if (!csvText.trim()) return;
    setPreview(importRecurringFromCsv(csvText, categories));
  }

  function handleConfirmImport() {
    if (!preview || preview.templates.length === 0) return;
    importRecurringTemplates(preview.newCategories, preview.templates);
    setShowImport(false);
    setCsvText("");
    setPreview(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-semibold">Recorrentes</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={openImport}>
            <span className="flex items-center gap-1">
              <Upload size={16} /> Importar CSV
            </span>
          </Button>
          <Button onClick={openNew}>
            <span className="flex items-center gap-1">
              <Plus size={16} /> Novo recorrente
            </span>
          </Button>
        </div>
      </div>
      <p className="text-sm text-[var(--text-muted)]">
        Cadastre entradas e saídas fixas (salário, aluguel, assinaturas) e
        lance-as no mês com um clique.
      </p>

      {duplicateGroups.length > 0 && (
        <Card>
          <div className="flex items-start gap-3">
            <AlertTriangle
              size={20}
              className="text-[var(--expense)] shrink-0 mt-0.5"
            />
            <div className="flex-1">
              <h2 className="font-medium mb-1">
                {duplicateGroups.length} recorrente
                {duplicateGroups.length !== 1 ? "s" : ""} duplicado
                {duplicateGroups.length !== 1 ? "s" : ""}
              </h2>
              <p className="text-sm text-[var(--text-muted)] mb-2">
                Cada um está cadastrado mais de uma vez, então os lançamentos
                futuros dele (e as entradas/saídas projetadas) estão contados
                em dobro:
              </p>
              <ul className="text-sm text-[var(--text-muted)] mb-3 space-y-0.5">
                {duplicateGroups.map((group) => (
                  <li key={group[0].id}>
                    {group[0].description} ({formatBRL(group[0].amount)}) ·{" "}
                    {group.length}x
                  </li>
                ))}
              </ul>
              <Button variant="danger" onClick={handleRemoveDuplicates}>
                Remover duplicados automaticamente
              </Button>
            </div>
          </div>
        </Card>
      )}

      {dedupeResult && (
        <Card>
          <p className="text-sm text-[var(--income)]">
            {dedupeResult.removedTemplates > 0
              ? `Removi ${dedupeResult.removedTemplates} recorrente${dedupeResult.removedTemplates !== 1 ? "s" : ""} duplicado${dedupeResult.removedTemplates !== 1 ? "s" : ""} e ${dedupeResult.removedTransactions} lançamento${dedupeResult.removedTransactions !== 1 ? "s" : ""} gerado${dedupeResult.removedTransactions !== 1 ? "s" : ""} por eles.`
              : "Nenhum duplicado encontrado."}
          </p>
        </Card>
      )}

      {showImport && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">Importar recorrentes de um CSV</h2>
            <button onClick={() => setShowImport(false)} aria-label="Fechar">
              <X size={18} />
            </button>
          </div>
          <p className="text-sm text-[var(--text-muted)] mb-3">
            Colunas esperadas: descrição, valor, dia_do_mes e, opcionalmente,
            tipo (entrada/saída), categoria e forma de pagamento.
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
                placeholder="descricao,valor,tipo,categoria,forma_pagamento,dia_do_mes"
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
                    {preview.templates.length} recorrente
                    {preview.templates.length !== 1 ? "s" : ""}
                  </span>{" "}
                  pronto{preview.templates.length !== 1 ? "s" : ""} para
                  importar
                  {preview.newCategories.length > 0 && (
                    <>
                      {" "}
                      · {preview.newCategories.length} categoria
                      {preview.newCategories.length !== 1 ? "s" : ""} nova
                      {preview.newCategories.length !== 1 ? "s" : ""}
                    </>
                  )}
                </p>
                {preview.errors.length > 0 && (
                  <ul className="text-xs text-[var(--expense)] mb-2 space-y-0.5">
                    {preview.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
                {preview.templates.length > 0 && (
                  <ul className="text-sm divide-y divide-[var(--border)] max-h-64 overflow-y-auto mb-3">
                    {preview.templates.map((t, i) => (
                      <li key={i} className="py-1.5 flex justify-between gap-3">
                        <span className="truncate">
                          Dia {t.dayOfMonth} · {t.description}
                        </span>
                        <span
                          className={
                            t.type === "income"
                              ? "text-[var(--income)] shrink-0"
                              : "text-[var(--expense)] shrink-0"
                          }
                        >
                          {t.type === "income" ? "+" : "-"}
                          {formatBRL(t.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setShowImport(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleConfirmImport}
                    disabled={preview.templates.length === 0}
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
              {editingId ? "Editar recorrente" : "Novo recorrente"}
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
                placeholder="Ex: Salário, Aluguel, Netflix..."
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
              <Label>Dia do mês</Label>
              <Input
                type="number"
                min="1"
                max="31"
                value={form.dayOfMonth}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dayOfMonth: Number(e.target.value) }))
                }
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
        {templates.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            Nenhum recorrente cadastrado.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {templates.map((t) => {
              const done = launchedThisMonth(t.id);
              return (
                <li
                  key={t.id}
                  className="py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="truncate">{t.description}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      Todo dia {t.dayOfMonth} · {categoryById[t.categoryId]?.name}
                      {t.paymentMethod === "credit_card" ? " · cartão" : ""}
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
                    <Button
                      variant={done ? "secondary" : "primary"}
                      disabled={done}
                      onClick={() => handleLaunch(t.id)}
                      className="flex items-center gap-1"
                    >
                      <PlayCircle size={15} />
                      {done ? "Lançado" : "Lançar no mês"}
                    </Button>
                    <button onClick={() => openEdit(t)} aria-label="Editar">
                      <Pencil size={15} className="text-[var(--text-muted)]" />
                    </button>
                    <button
                      onClick={() => removeRecurringTemplate(t.id)}
                      aria-label="Excluir"
                    >
                      <Trash2 size={15} className="text-[var(--expense)]" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
