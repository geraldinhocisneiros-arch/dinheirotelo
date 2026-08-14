import type { RecurringTemplate, Transaction } from "@/lib/types";
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

// Saldo acumulado ate o fim do mes informado (inclusive). Isso inclui
// lancamentos futuros ja datados dentro desse mes (ex: aluguel do dia 27
// lancado com antecedencia) - e por isso serve de base para a projecao de
// fim de mes, nao para "quanto eu tenho agora".
export function accountBalanceUpTo(
  transactions: Transaction[],
  yearMonth: string,
): number {
  return transactions
    .filter((t) => t.paymentMethod === "account" && monthOf(t.date) <= yearMonth)
    .reduce((sum, t) => sum + (t.type === "income" ? t.amount : -t.amount), 0);
}

// Saldo real na data informada (normalmente hoje): soma so o que ja
// aconteceu ate essa data, ignorando lancamentos futuros mesmo que ja
// estejam cadastrados com antecedencia dentro do mes.
export function accountBalanceAsOf(
  transactions: Transaction[],
  asOfDateIso: string,
): number {
  return transactions
    .filter((t) => t.paymentMethod === "account" && t.date <= asOfDateIso)
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

// Recorrentes de conta que ainda nao foram lancados no mes informado.
export function pendingRecurringInMonth(
  templates: RecurringTemplate[],
  transactions: Transaction[],
  yearMonth: string,
): RecurringTemplate[] {
  return templates.filter(
    (t) =>
      t.active &&
      t.paymentMethod === "account" &&
      !transactions.some(
        (tx) => tx.recurringTemplateId === t.id && monthOf(tx.date) === yearMonth,
      ),
  );
}

// Saldo projetado: saldo ja lancado ate o fim do mes + recorrentes de conta
// que ainda vao entrar/sair nesse mes mas ainda nao foram lancados.
// Atualiza sozinho conforme o estado muda (React re-renderiza a partir do
// store), entao "tempo real" aqui significa: sempre reflete o estado atual.
export function projectedBalance(
  transactions: Transaction[],
  templates: RecurringTemplate[],
  yearMonth: string,
): number {
  const base = accountBalanceUpTo(transactions, yearMonth);
  const pending = pendingRecurringInMonth(templates, transactions, yearMonth);
  const pendingDelta = pending.reduce(
    (sum, t) => sum + (t.type === "income" ? t.amount : -t.amount),
    0,
  );
  return base + pendingDelta;
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
