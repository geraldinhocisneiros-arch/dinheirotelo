import type { Budget, RecurringTemplate, Transaction } from "@/lib/types";
import { currentYearMonth, faturaYearMonth } from "@/lib/fatura";
import { shiftMonth } from "@/lib/date";

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

// Saldo real: soma so o que ja foi de fato marcado como pago/recebido
// (settled), independente da data cadastrada. E o que da baixa de verdade -
// diferente da projecao, que usa a data planejada.
export function accountBalanceSettled(transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.paymentMethod === "account" && t.settled)
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

// Parte do orcamento (Feira, Gasolina etc.) ainda nao gasta em um mes, que a
// projecao assume que vai ser gasta ate o fim daquele mes - por isso o
// orcamento ja "conta como saida" desde o dia 1, igual um recorrente.
// Conforme voce realmente gasta (ou nao) em cada categoria, essa sobra some
// sozinha e vira saldo de verdade; se estourar o limite, o gasto real ja
// pesa no saldo normalmente, sem precisar de ajuste extra aqui.
function pendingBudgetForSingleMonth(
  transactions: Transaction[],
  budgets: Budget[],
  yearMonth: string,
): number {
  return budgets.reduce((sum, b) => {
    const spent = transactionsInMonth(transactions, yearMonth)
      .filter(
        (t) =>
          t.categoryId === b.categoryId &&
          t.type === "expense" &&
          t.paymentMethod === "account",
      )
      .reduce((s, t) => s + t.amount, 0);
    return sum + Math.max(b.monthlyLimit - spent, 0);
  }, 0);
}

// Soma o orcamento pendente do mes atual ate o mes projetado (inclusive) -
// cada mes futuro entra com o orcamento cheio, igual um recorrente. Meses ja
// fechados (no passado) nao entram: o que nao foi gasto neles ja ficou no
// saldo, sem precisar de ajuste.
export function pendingBudgetInMonth(
  transactions: Transaction[],
  budgets: Budget[],
  yearMonth: string,
): number {
  const now = currentYearMonth();
  if (yearMonth < now) return 0;
  let sum = 0;
  let ym = now;
  while (ym <= yearMonth) {
    sum += pendingBudgetForSingleMonth(transactions, budgets, ym);
    ym = shiftMonth(ym, 1);
  }
  return sum;
}

// Saldo projetado: saldo ja lancado ate o fim do mes + recorrentes de conta
// que ainda vao entrar/sair nesse mes mas ainda nao foram lancados + o que
// ainda resta dos orcamentos do mes (assumido como saida ate o fim do mes).
// Atualiza sozinho conforme o estado muda (React re-renderiza a partir do
// store), entao "tempo real" aqui significa: sempre reflete o estado atual.
export function projectedBalance(
  transactions: Transaction[],
  templates: RecurringTemplate[],
  budgets: Budget[],
  yearMonth: string,
): number {
  const base = accountBalanceUpTo(transactions, yearMonth);
  const pending = pendingRecurringInMonth(templates, transactions, yearMonth);
  const pendingDelta = pending.reduce(
    (sum, t) => sum + (t.type === "income" ? t.amount : -t.amount),
    0,
  );
  const pendingBudget = pendingBudgetInMonth(transactions, budgets, yearMonth);
  return base + pendingDelta - pendingBudget;
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
