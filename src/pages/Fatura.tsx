import { useMemo, useRef, useState } from "react";
import { useFinanceStore } from "@/store/useFinanceStore";
import { Button, Card, Label, Select } from "@/components/ui";
import { formatBRL, formatDateBR } from "@/lib/format";
import { creditCardTransactionsByFatura } from "@/lib/selectors";
import { currentYearMonth, formatYearMonth } from "@/lib/fatura";
import { reconcileNubankCsv, type ReconcileResult } from "@/lib/nubankReconcile";
import { CheckCircle2, Circle, Trash2, Upload, X } from "lucide-react";

export function Fatura() {
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const faturaPayments = useFinanceStore((s) => s.faturaPayments);
  const setFaturaPaid = useFinanceStore((s) => s.setFaturaPaid);
  const importTransactions = useFinanceStore((s) => s.importTransactions);
  const removeTransaction = useFinanceStore((s) => s.removeTransaction);

  const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]));
  const byFatura = useMemo(
    () => creditCardTransactionsByFatura(transactions),
    [transactions],
  );

  const [expanded, setExpanded] = useState<string | null>(currentYearMonth());

  const months = [...byFatura.keys()].sort().reverse();

  const expenseCategories = categories.filter((c) => c.type === "expense");
  const defaultNewCategoryId =
    categories.find((c) => c.id === "cat-outros-despesa")?.id ??
    expenseCategories[0]?.id ??
    "";

  const [showReconcile, setShowReconcile] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [newCategoryId, setNewCategoryId] = useState(defaultNewCategoryId);
  const [preview, setPreview] = useState<ReconcileResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function openReconcile() {
    setCsvText("");
    setPreview(null);
    setNewCategoryId(defaultNewCategoryId);
    setShowReconcile(true);
  }

  function analyze(text: string, categoryId: string) {
    setPreview(reconcileNubankCsv(text, transactions, categoryId));
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    analyze(text, newCategoryId);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleAnalyze() {
    if (!csvText.trim()) return;
    analyze(csvText, newCategoryId);
  }

  function handleConfirmReconcile() {
    if (!preview || preview.toImport.length === 0) return;
    importTransactions([], preview.toImport);
    setShowReconcile(false);
    setCsvText("");
    setPreview(null);
  }

  const newRowsByMonth = useMemo(() => {
    if (!preview) return [];
    const map = new Map<string, typeof preview.rows>();
    for (const row of preview.rows) {
      if (row.alreadyExists) continue;
      const list = map.get(row.faturaMonth) ?? [];
      list.push(row);
      map.set(row.faturaMonth, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [preview]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Fatura do Cartão</h1>
        <Button variant="secondary" onClick={openReconcile}>
          <span className="flex items-center gap-1">
            <Upload size={16} /> Conciliar fatura Nubank
          </span>
        </Button>
      </div>
      <p className="text-sm text-[var(--text-muted)]">
        Compras feitas até o dia 8 entram na fatura do mês corrente; a partir
        do dia 9, entram na fatura do mês seguinte.
      </p>

      {showReconcile && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">Conciliar com extrato do Nubank</h2>
            <button onClick={() => setShowReconcile(false)} aria-label="Fechar">
              <X size={18} />
            </button>
          </div>
          <p className="text-sm text-[var(--text-muted)] mb-3">
            Envie o CSV exportado do Nubank (colunas date, title, amount).
            Lançamentos que já existem na fatura (mesma data e valor) são
            ignorados automaticamente — nada é duplicado ou cancelado. Compras
            parceladas geram as parcelas futuras nos meses seguintes.
          </p>
          <div className="flex flex-col gap-3">
            <div>
              <Label>Arquivo CSV do Nubank</Label>
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
                placeholder="date,title,amount"
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
            <div>
              <Label>Categoria para os lançamentos novos</Label>
              <Select
                value={newCategoryId}
                onChange={(e) => {
                  setNewCategoryId(e.target.value);
                  if (csvText.trim()) analyze(csvText, e.target.value);
                }}
              >
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={handleAnalyze}>
                Analisar
              </Button>
            </div>

            {preview && (
              <div className="border-t border-[var(--border)] pt-3">
                <p className="text-sm mb-2">
                  <span className="text-[var(--text-muted)]">
                    {preview.alreadyCount} já lançado
                    {preview.alreadyCount !== 1 ? "s" : ""} (ignorado
                    {preview.alreadyCount !== 1 ? "s" : ""})
                  </span>
                  {" · "}
                  <span className="font-medium text-[var(--income)]">
                    {preview.toImport.length} novo
                    {preview.toImport.length !== 1 ? "s" : ""}
                  </span>{" "}
                  para importar
                </p>

                {newRowsByMonth.length > 0 ? (
                  <div className="space-y-3 mb-3">
                    {newRowsByMonth.map(([ym, rows]) => (
                      <div key={ym}>
                        <div className="text-xs font-medium text-[var(--text-muted)] mb-1 capitalize">
                          {formatYearMonth(ym)}
                        </div>
                        <ul className="text-sm divide-y divide-[var(--border)]">
                          {rows.map((r, i) => (
                            <li key={i} className="py-1.5 flex justify-between gap-3">
                              <span className="truncate">
                                {formatDateBR(r.date)} · {r.description}
                                {r.isFutureInstallment && (
                                  <span className="text-[var(--text-muted)]">
                                    {" "}
                                    (parcela futura)
                                  </span>
                                )}
                              </span>
                              <span className="text-[var(--expense)] shrink-0">
                                {formatBRL(r.amount)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-muted)] mb-3">
                    Nada novo — todos os lançamentos do extrato já estão na
                    fatura.
                  </p>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setShowReconcile(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleConfirmReconcile}
                    disabled={preview.toImport.length === 0}
                  >
                    Importar {preview.toImport.length} lançamento
                    {preview.toImport.length !== 1 ? "s" : ""}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {months.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--text-muted)]">
            Nenhuma compra no cartão ainda.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {months.map((ym) => {
            const items = byFatura.get(ym)!;
            const total = items.reduce((s, t) => s + t.amount, 0);
            const payment = faturaPayments.find((f) => f.yearMonth === ym);
            const paid = payment?.paid ?? false;
            const isOpen = expanded === ym;

            return (
              <Card key={ym}>
                <button
                  className="w-full flex items-center justify-between"
                  onClick={() => setExpanded(isOpen ? null : ym)}
                >
                  <div className="text-left">
                    <div className="font-medium capitalize">
                      {formatYearMonth(ym)}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {items.length} compra{items.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-[var(--card)]">
                      {formatBRL(total)}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        paid
                          ? "bg-[var(--income)] text-white"
                          : "bg-[var(--border)] text-[var(--text-muted)]"
                      }`}
                    >
                      {paid ? "Paga" : "Em aberto"}
                    </span>
                  </div>
                </button>

                {isOpen && (
                  <div className="mt-3 border-t border-[var(--border)] pt-3">
                    <ul className="divide-y divide-[var(--border)] mb-3">
                      {items
                        .sort((a, b) => a.date.localeCompare(b.date))
                        .map((t) => (
                          <li
                            key={t.id}
                            className="py-2 flex items-center justify-between gap-3 text-sm"
                          >
                            <div className="min-w-0">
                              <div className="truncate">{t.description}</div>
                              <div className="text-xs text-[var(--text-muted)]">
                                {formatDateBR(t.date)} ·{" "}
                                {categoryById[t.categoryId]?.name}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span>{formatBRL(t.amount)}</span>
                              <button
                                onClick={() => removeTransaction(t.id)}
                                aria-label="Excluir"
                              >
                                <Trash2
                                  size={14}
                                  className="text-[var(--expense)]"
                                />
                              </button>
                            </div>
                          </li>
                        ))}
                    </ul>
                    <Button
                      variant={paid ? "secondary" : "primary"}
                      onClick={() => setFaturaPaid(ym, !paid)}
                      className="flex items-center gap-1"
                    >
                      {paid ? (
                        <>
                          <Circle size={15} /> Marcar como não paga
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={15} /> Marcar fatura como paga
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
