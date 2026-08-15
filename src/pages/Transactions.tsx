import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useFinanceStore } from "@/store/useFinanceStore";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { MonthSelector } from "@/components/MonthSelector";
import { formatBRL, formatDateBR, todayIso } from "@/lib/format";
import { currentYearMonth, faturaYearMonth, formatYearMonth } from "@/lib/fatura";
import { creditCardTransactionsByFatura } from "@/lib/selectors";
import { importTransactionsFromCsv, type ImportResult } from "@/lib/importTransactions";
import { reconcileBankStatement, type BankReconcileResult } from "@/lib/bankReconcile";
import { exportBackup, parseBackup, applyBackup } from "@/lib/backup";
import type { EntryType, PaymentMethod, Transaction } from "@/lib/types";
import {
  Trash2,
  Pencil,
  Plus,
  X,
  Upload,
  Landmark,
  Check,
  Circle,
  AlertTriangle,
  Download,
  Copy,
  FileUp,
  CreditCard,
} from "lucide-react";

type FormState = Omit<Transaction, "id">;

const emptyForm = (): FormState => ({
  date: todayIso(),
  description: "",
  amount: 0,
  type: "expense",
  categoryId: "",
  paymentMethod: "account",
  settled: true,
});

export function Transactions() {
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const faturaPayments = useFinanceStore((s) => s.faturaPayments);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const updateTransaction = useFinanceStore((s) => s.updateTransaction);
  const removeTransaction = useFinanceStore((s) => s.removeTransaction);
  const removeAllTransactions = useFinanceStore((s) => s.removeAllTransactions);
  const setTransactionSettled = useFinanceStore((s) => s.setTransactionSettled);
  const importTransactions = useFinanceStore((s) => s.importTransactions);

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  function handleConfirmClearAll() {
    removeAllTransactions();
    setShowClearConfirm(false);
  }

  const [showExport, setShowExport] = useState(false);
  const [exportCopied, setExportCopied] = useState(false);
  const [showImportBackup, setShowImportBackup] = useState(false);
  const [backupText, setBackupText] = useState("");
  const [backupError, setBackupError] = useState<string | null>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  function openExport() {
    setExportCopied(false);
    setShowExport(true);
  }

  function handleCopyExport() {
    const json = exportBackup();
    navigator.clipboard?.writeText(json).catch(() => {});
    setExportCopied(true);
    setTimeout(() => setExportCopied(false), 1500);
  }

  function openImportBackup() {
    setBackupText("");
    setBackupError(null);
    setShowImportBackup(true);
  }

  async function handleBackupFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setBackupText(text);
    if (backupFileInputRef.current) backupFileInputRef.current.value = "";
  }

  function handleConfirmImportBackup() {
    setBackupError(null);
    try {
      const data = parseBackup(backupText);
      applyBackup(data);
      setShowImportBackup(false);
      setBackupText("");
    } catch {
      setBackupError(
        "Não consegui ler esse backup. Confira se colou o conteúdo completo.",
      );
    }
  }

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [filterType, setFilterType] = useState<"all" | EntryType>("all");
  const [ym, setYm] = useState(currentYearMonth());

  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showReconcile, setShowReconcile] = useState(false);
  const [statementText, setStatementText] = useState("");
  const [statementPreview, setStatementPreview] = useState<BankReconcileResult | null>(null);
  const statementFileInputRef = useRef<HTMLInputElement>(null);

  const incomeCategoryId =
    categories.find((c) => c.id === "cat-outros-receita")?.id ??
    categories.find((c) => c.type === "income")?.id ??
    "";
  const expenseCategoryId =
    categories.find((c) => c.id === "cat-outros-despesa")?.id ??
    categories.find((c) => c.type === "expense")?.id ??
    "";

  const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]));
  const categoriesForType = categories.filter((c) => c.type === form.type);

  // Compras no cartao nao aparecem uma a uma aqui - viram uma unica linha de
  // fatura (ver faturaTotal abaixo). O detalhamento fica so na pagina
  // "Fatura do Cartão".
  const sorted = useMemo(
    () =>
      [...transactions]
        .filter((t) => t.date.slice(0, 7) === ym)
        .filter((t) => t.paymentMethod !== "credit_card")
        .filter((t) => filterType === "all" || t.type === filterType)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, filterType, ym],
  );

  const faturaItems = useMemo(
    () => creditCardTransactionsByFatura(transactions).get(ym) ?? [],
    [transactions, ym],
  );
  const faturaTotal = faturaItems.reduce((s, t) => s + t.amount, 0);
  const faturaPaid = faturaPayments.find((f) => f.yearMonth === ym)?.paid ?? false;
  const showFaturaRow =
    faturaItems.length > 0 && (filterType === "all" || filterType === "expense");

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

  function openReconcile() {
    setStatementText("");
    setStatementPreview(null);
    setShowReconcile(true);
  }

  function analyzeStatement(text: string) {
    setStatementPreview(
      reconcileBankStatement(text, transactions, categories, incomeCategoryId, expenseCategoryId),
    );
  }

  async function handleStatementFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setStatementText(text);
    analyzeStatement(text);
    if (statementFileInputRef.current) statementFileInputRef.current.value = "";
  }

  function handleAnalyzeStatement() {
    if (!statementText.trim()) return;
    analyzeStatement(statementText);
  }

  function handleConfirmReconcile() {
    if (!statementPreview || statementPreview.toImport.length === 0) return;
    importTransactions([], statementPreview.toImport);
    setShowReconcile(false);
    setStatementText("");
    setStatementPreview(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-semibold">Lançamentos</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={openReconcile}>
            <span className="flex items-center gap-1">
              <Landmark size={16} /> Conciliar extrato bancário
            </span>
          </Button>
          <Button variant="secondary" onClick={openImport}>
            <span className="flex items-center gap-1">
              <Upload size={16} /> Importar CSV
            </span>
          </Button>
          <Button variant="secondary" onClick={openExport}>
            <span className="flex items-center gap-1">
              <Download size={16} /> Exportar tudo
            </span>
          </Button>
          <Button variant="secondary" onClick={openImportBackup}>
            <span className="flex items-center gap-1">
              <FileUp size={16} /> Importar backup
            </span>
          </Button>
          <Button onClick={openNew}>
            <span className="flex items-center gap-1">
              <Plus size={16} /> Novo lançamento
            </span>
          </Button>
          {transactions.length > 0 && (
            <Button variant="danger" onClick={() => setShowClearConfirm(true)}>
              <span className="flex items-center gap-1">
                <AlertTriangle size={16} /> Limpar tudo
              </span>
            </Button>
          )}
        </div>
      </div>

      {showExport && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">Exportar tudo</h2>
            <button onClick={() => setShowExport(false)} aria-label="Fechar">
              <X size={18} />
            </button>
          </div>
          <p className="text-sm text-[var(--text-muted)] mb-3">
            Copie esse conteúdo e cole em "Importar backup" no outro
            aparelho/link pra trazer todos os seus dados pra lá.
          </p>
          <textarea
            readOnly
            value={exportBackup()}
            rows={8}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-xs font-mono"
            onFocus={(e) => e.target.select()}
          />
          <div className="flex justify-end mt-3">
            <Button
              onClick={handleCopyExport}
              className="flex items-center gap-1"
            >
              {exportCopied ? <Check size={15} /> : <Copy size={15} />}
              {exportCopied ? "Copiado!" : "Copiar tudo"}
            </Button>
          </div>
        </Card>
      )}

      {showImportBackup && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">Importar backup</h2>
            <button onClick={() => setShowImportBackup(false)} aria-label="Fechar">
              <X size={18} />
            </button>
          </div>
          <p className="text-sm text-[var(--text-muted)] mb-3">
            Isso substitui TODOS os dados deste aparelho pelos do backup. Cole
            o conteúdo copiado em "Exportar tudo", ou envie o arquivo.
          </p>
          <div className="flex flex-col gap-3">
            <input
              ref={backupFileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleBackupFileChange}
              className="text-sm"
            />
            <textarea
              value={backupText}
              onChange={(e) => setBackupText(e.target.value)}
              rows={8}
              placeholder='{"categories": [...], "transactions": [...], ...}'
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            {backupError && (
              <p className="text-sm text-[var(--expense)]">{backupError}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setShowImportBackup(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmImportBackup}
                disabled={!backupText.trim()}
              >
                Substituir pelos dados do backup
              </Button>
            </div>
          </div>
        </Card>
      )}

      {showClearConfirm && (
        <Card className="border-[var(--expense)]">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-[var(--expense)] shrink-0 mt-0.5" />
            <div className="flex-1">
              <h2 className="font-medium mb-1">Apagar todos os lançamentos?</h2>
              <p className="text-sm text-[var(--text-muted)] mb-3">
                Isso vai apagar TODOS os {transactions.length} lançamentos e o
                status de faturas pagas. Categorias, orçamentos e recorrentes
                continuam como estão. Não dá pra desfazer.
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="secondary" onClick={() => setShowClearConfirm(false)}>
                  Cancelar
                </Button>
                <Button variant="danger" onClick={handleConfirmClearAll}>
                  Sim, apagar tudo
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <MonthSelector value={ym} onChange={setYm} />
      </div>

      {showReconcile && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">Conciliar extrato bancário</h2>
            <button onClick={() => setShowReconcile(false)} aria-label="Fechar">
              <X size={18} />
            </button>
          </div>
          <p className="text-sm text-[var(--text-muted)] mb-3">
            Cole ou envie o extrato (colunas date, title, amount — valor
            negativo para saída, positivo para entrada). Lançamentos que já
            existem no mesmo mês e valor são ignorados automaticamente; o
            resto é adicionado como novo lançamento de conta.
          </p>
          <div className="flex flex-col gap-3">
            <div>
              <Label>Arquivo do extrato</Label>
              <input
                ref={statementFileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleStatementFileChange}
                className="text-sm"
              />
            </div>
            <div>
              <Label>Ou cole o conteúdo aqui</Label>
              <textarea
                value={statementText}
                onChange={(e) => setStatementText(e.target.value)}
                rows={6}
                placeholder="date,title,amount"
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={handleAnalyzeStatement}>
                Analisar
              </Button>
            </div>

            {statementPreview && (
              <div className="border-t border-[var(--border)] pt-3">
                <p className="text-sm mb-2">
                  <span className="text-[var(--text-muted)]">
                    {statementPreview.alreadyCount} já lançado
                    {statementPreview.alreadyCount !== 1 ? "s" : ""} (ignorado
                    {statementPreview.alreadyCount !== 1 ? "s" : ""})
                  </span>
                  {" · "}
                  <span className="font-medium text-[var(--income)]">
                    {statementPreview.toImport.length} novo
                    {statementPreview.toImport.length !== 1 ? "s" : ""}
                  </span>{" "}
                  para importar
                </p>
                {statementPreview.toImport.length > 0 ? (
                  <ul className="text-sm divide-y divide-[var(--border)] max-h-64 overflow-y-auto mb-3">
                    {statementPreview.rows
                      .filter((r) => !r.alreadyExists)
                      .map((r, i) => (
                        <li key={i} className="py-1.5 flex justify-between gap-3">
                          <span className="truncate">
                            {formatDateBR(r.date)} · {r.description}
                          </span>
                          <span
                            className={
                              r.type === "income"
                                ? "text-[var(--income)] shrink-0"
                                : "text-[var(--expense)] shrink-0"
                            }
                          >
                            {r.type === "income" ? "+" : "-"}
                            {formatBRL(r.amount)}
                          </span>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[var(--text-muted)] mb-3">
                    Nada novo — o extrato já bate com o que está lançado.
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setShowReconcile(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleConfirmReconcile}
                    disabled={statementPreview.toImport.length === 0}
                  >
                    Importar {statementPreview.toImport.length} lançamento
                    {statementPreview.toImport.length !== 1 ? "s" : ""}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

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
            {form.paymentMethod === "account" && (
              <label className="sm:col-span-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.settled}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, settled: e.target.checked }))
                  }
                />
                {form.type === "income"
                  ? "Já recebi esse valor"
                  : "Já paguei esse valor"}
              </label>
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
        {showFaturaRow && (
          <Link
            to="/fatura"
            className="py-2.5 flex items-center justify-between gap-3 border-b border-[var(--border)] mb-1 hover:opacity-80"
          >
            <div className="min-w-0 flex items-center gap-2">
              <CreditCard size={16} className="text-[var(--card)] shrink-0" />
              <div>
                <div className="font-medium">FATURA DO CARTÃO</div>
                <div className="text-xs text-[var(--text-muted)]">
                  {faturaItems.length} compra{faturaItems.length !== 1 ? "s" : ""} ·{" "}
                  {faturaPaid ? "paga" : "em aberto"} · ver detalhes em Fatura do
                  Cartão
                </div>
              </div>
            </div>
            <span className="text-[var(--expense)] font-medium shrink-0">
              -{formatBRL(faturaTotal)}
            </span>
          </Link>
        )}
        {sorted.length === 0 && !showFaturaRow ? (
          <p className="text-sm text-[var(--text-muted)]">
            Nenhum lançamento em {formatYearMonth(ym)}.
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
