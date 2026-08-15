import type { Budget, FaturaPayment, RecurringTemplate, Transaction } from "@/lib/types";
import { currentYearMonth, faturaYearMonth } from "@/lib/fatura";

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

// Lancamentos de conta ja cadastrados (com data <= fim do mes projetado) mas
// ainda nao marcados como pago/recebido - eles ja entram na projecao (via
// accountBalanceUpTo) silenciosamente, entao esse selector existe so pra
// mostrar na tela quais sao, pra projecao nao virar uma caixa-preta.
export function unsettledAccountTransactionsUpTo(
  transactions: Transaction[],
  yearMonth: string,
): Transaction[] {
  return transactions.filter(
    (t) => t.paymentMethod === "account" && !t.settled && monthOf(t.date) <= yearMonth,
  );
}

// Recorrentes de conta que ainda nao foram lancados no mes informado.
// "Lancado" nao e so quando o recorrente foi disparado via autoLaunch/Lançar
// no mes (vinculado por recurringTemplateId) - tambem conta se ja existe um
// lancamento manual (ex: digitado direto em Lançamentos, ou vindo de uma
// conciliacao de extrato) com a mesma descricao e tipo neste mes. Sem isso,
// um recorrente que voce ja pagou/recebeu por fora continuaria contando como
// "ainda falta" e descontaria a projecao de novo, em cima do que ja esta no
// saldo atual.
export function pendingRecurringInMonth(
  templates: RecurringTemplate[],
  transactions: Transaction[],
  yearMonth: string,
): RecurringTemplate[] {
  return templates.filter((t) => {
    if (!t.active || t.paymentMethod !== "account") return false;
    return !transactions.some((tx) => {
      if (monthOf(tx.date) !== yearMonth || tx.paymentMethod !== "account") {
        return false;
      }
      if (tx.recurringTemplateId === t.id) return true;
      return (
        tx.type === t.type &&
        tx.description.trim().toLowerCase() === t.description.trim().toLowerCase()
      );
    });
  });
}

// Parte do orcamento (Feira, Gasolina etc.) ainda nao gasta no mes
// projetado, que a projecao assume que vai ser gasta ate o fim daquele mes -
// por isso o orcamento ja "conta como saida" desde o dia 1, igual um
// recorrente. Conforme voce realmente gasta (ou nao) em cada categoria, essa
// sobra some sozinha e vira saldo de verdade; se estourar o limite, o gasto
// real ja pesa no saldo normalmente, sem precisar de ajuste extra aqui. Usa
// gasto de qualquer forma de pagamento (conta ou cartao): uma compra no
// cartao ja entra no saldo projetado pela fatura em aberto (ver
// pendingFaturaUpTo), e contar de novo aqui como "ainda falta gastar"
// duplicaria o desconto. So considera o mes projetado em si (nao soma com
// meses anteriores) - um mes ja fechado nao entra: o que nao foi gasto nele
// ja ficou no saldo, sem precisar de ajuste.
export function pendingBudgetInMonth(
  transactions: Transaction[],
  budgets: Budget[],
  yearMonth: string,
): number {
  if (yearMonth < currentYearMonth()) return 0;
  return budgets.reduce((sum, b) => {
    const spent = categorySpendInMonth(transactions, b.categoryId, yearMonth);
    return sum + Math.max(b.monthlyLimit - spent, 0);
  }, 0);
}

// Saldo projetado: saldo ja lancado ate o fim do mes + recorrentes de conta
// que ainda vao entrar/sair nesse mes mas ainda nao foram lancados + o que
// ainda resta dos orcamentos do mes (assumido como saida ate o fim do mes) +
// faturas do cartao ainda em aberto (assumidas como saida ate serem pagas).
// Atualiza sozinho conforme o estado muda (React re-renderiza a partir do
// store), entao "tempo real" aqui significa: sempre reflete o estado atual.
export function projectedBalance(
  transactions: Transaction[],
  templates: RecurringTemplate[],
  budgets: Budget[],
  faturaPayments: FaturaPayment[],
  yearMonth: string,
): number {
  const base = accountBalanceUpTo(transactions, yearMonth);
  const pending = pendingRecurringInMonth(templates, transactions, yearMonth);
  const pendingDelta = pending.reduce(
    (sum, t) => sum + (t.type === "income" ? t.amount : -t.amount),
    0,
  );
  const pendingBudget = pendingBudgetInMonth(transactions, budgets, yearMonth);
  const pendingFatura = pendingFaturaUpTo(transactions, faturaPayments, yearMonth);
  return base + pendingDelta - pendingBudget - pendingFatura;
}

// Descricao usada pro lancamento sintetico que representa "paguei a fatura
// desse mes" - centralizado aqui pra loja e selectors usarem a mesma string.
export function faturaPaymentDescription(yearMonth: string): string {
  return `Fatura do cartão ${yearMonth}`;
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

// Total da fatura de um mes especifico, so enquanto ela ainda nao foi paga -
// depois de paga vira uma saida de conta de verdade (lancada na data do
// pagamento), entao ja aparece nas contas normalmente e nao precisa mais
// entrar aqui.
export function pendingFaturaInMonth(
  transactions: Transaction[],
  faturaPayments: FaturaPayment[],
  yearMonth: string,
): number {
  const paid = faturaPayments.find((f) => f.yearMonth === yearMonth)?.paid ?? false;
  if (paid) return 0;
  return transactions
    .filter(
      (t) => t.paymentMethod === "credit_card" && faturaYearMonth(t.date) === yearMonth,
    )
    .reduce((s, t) => s + t.amount, 0);
}

// Todas as faturas ainda em aberto ate o mes projetado (inclusive), uma por
// mes - uma fatura nao paga continua pesando no saldo projetado dos meses
// seguintes, ate que seja marcada como paga. Retorna a lista (nao so o
// total) pra dar pra mostrar cada mes em aberto na tela, senao a projecao
// soma coisa que ninguem consegue ver de onde veio.
export function openFaturasUpTo(
  transactions: Transaction[],
  faturaPayments: FaturaPayment[],
  yearMonth: string,
): { yearMonth: string; total: number }[] {
  const byFatura = creditCardTransactionsByFatura(transactions);
  const result: { yearMonth: string; total: number }[] = [];
  for (const [ym, items] of byFatura) {
    if (ym > yearMonth) continue;
    const paid = faturaPayments.find((f) => f.yearMonth === ym)?.paid ?? false;
    if (paid) continue;
    const total = items.reduce((s, t) => s + t.amount, 0);
    if (total > 0) result.push({ yearMonth: ym, total });
  }
  return result.sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
}

// Soma todas as faturas ainda em aberto ate o mes projetado (inclusive).
export function pendingFaturaUpTo(
  transactions: Transaction[],
  faturaPayments: FaturaPayment[],
  yearMonth: string,
): number {
  return openFaturasUpTo(transactions, faturaPayments, yearMonth).reduce(
    (sum, f) => sum + f.total,
    0,
  );
}

function recurringDedupeKey(t: RecurringTemplate): string {
  return [
    t.description.trim().toLowerCase(),
    t.amount.toFixed(2),
    t.dayOfMonth,
    t.type,
    t.paymentMethod,
  ].join("|");
}

// Recorrentes cadastrados mais de uma vez (mesma descricao, valor, dia,
// tipo e forma de pagamento) - cada copia gera seu proprio lote de
// lancamentos futuros, entao um recorrente duplicado dobra entradas/saidas
// projetadas todo mes. Cada grupo retornado tem 2+ itens.
export function findDuplicateRecurringTemplates(
  templates: RecurringTemplate[],
): RecurringTemplate[][] {
  const groups = new Map<string, RecurringTemplate[]>();
  for (const t of templates) {
    const key = recurringDedupeKey(t);
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}
