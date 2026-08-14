import { useMemo, useState } from "react";
import { useFinanceStore } from "@/store/useFinanceStore";
import { Button, Card } from "@/components/ui";
import { formatBRL, formatDateBR } from "@/lib/format";
import { creditCardTransactionsByFatura } from "@/lib/selectors";
import { currentYearMonth, formatYearMonth } from "@/lib/fatura";
import { CheckCircle2, Circle } from "lucide-react";

export function Fatura() {
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const faturaPayments = useFinanceStore((s) => s.faturaPayments);
  const setFaturaPaid = useFinanceStore((s) => s.setFaturaPaid);

  const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]));
  const byFatura = useMemo(
    () => creditCardTransactionsByFatura(transactions),
    [transactions],
  );

  const [expanded, setExpanded] = useState<string | null>(currentYearMonth());

  const months = [...byFatura.keys()].sort().reverse();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Fatura do Cartão</h1>
      <p className="text-sm text-[var(--text-muted)]">
        Compras feitas até o dia 8 entram na fatura do mês corrente; a partir
        do dia 9, entram na fatura do mês seguinte.
      </p>

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
                            className="py-2 flex justify-between text-sm"
                          >
                            <div>
                              <div>{t.description}</div>
                              <div className="text-xs text-[var(--text-muted)]">
                                {formatDateBR(t.date)} ·{" "}
                                {categoryById[t.categoryId]?.name}
                              </div>
                            </div>
                            <div>{formatBRL(t.amount)}</div>
                          </li>
                        ))}
                    </ul>
                    <Button
                      variant={paid ? "secondary" : "primary"}
                      onClick={() => setFaturaPaid(ym, !paid, total)}
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
