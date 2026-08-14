import type { Transaction } from "@/lib/types";
import { faturaYearMonth } from "@/lib/fatura";

export function monthOf(dateIso: string): string {
  return dateIso.slice(0, 7);
}

export function transactionsInMonth(
  transactions: Transaction[],
  yearMonth: string,
): Transaction[] {
  return transactions.filter((t) => monthOf(t.date) === yearMonth);
}

// Saldo em conta: entradas e saidas diretas de conta. Compras no cartao só
// impactam o saldo quando a fatura é paga (vira uma saida de conta).
export function accountBalance(transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.paymentMethod === "account")
    .reduce((sum, t) => sum + (t.type === "income" ? t.amount : -t.amount), 0);
}

// Saldo acumulado ate o fim do mes informado (inclusive), para navegacao
// mensal: mostra o saldo "como estava" naquele mes, nao o saldo de hoje.
export function accountBalanceUpTo(
  transactions: Transaction[],
  yearMonth: string,
): number {
  return transactions
    .filter((t) => t.paymentMethod === "account" && monthOf(t.date) <= yearMonth)
    .reduce((sum, t) => sum + (t.type === "income" ? t.amount : -t.amount), 0);
}

export function monthIncomeExpense(
  transactions: Transaction[],
  yearMonth: string,
) {
  const inMonth = transactionsInMonth(transactions, yearMonth).filter(
    (t) => t.paymentMethod === "account",
  );
  const income = inMonth
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const expense = inMonth
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  return { income, expense };
}

// Gasto por categoria no mes, considerando data da compra (conta ou cartao).
export function categorySpendInMonth(
  transactions: Transaction[],
  categoryId: string,
  yearMonth: string,
): number {
  return transactionsInMonth(transactions, yearMonth)
    .filter((t) => t.categoryId === categoryId && t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
}

export function creditCardTransactionsByFatura(
  transactions: Transaction[],
): Map<string, Transaction[]> {
  const map = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (t.paymentMethod !== "credit_card") continue;
    const ym = faturaYearMonth(t.date);
    const list = map.get(ym) ?? [];
    list.push(t);
    map.set(ym, list);
  }
  return map;
}
