import type { Transaction } from "@/lib/types";
import { parseCSV } from "@/lib/csv";
import { parseSignedAmountBR } from "@/lib/money";
import { todayIso } from "@/lib/format";

interface StatementRow {
  date: string;
  title: string;
  amount: number; // com sinal: positivo = entrada, negativo = saida
}

function parseStatementCsv(text: string): StatementRow[] {
  const rows = parseCSV(text);
  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const dateIdx = headers.indexOf("date");
  const titleIdx = headers.indexOf("title");
  const amountIdx = headers.indexOf("amount");
  if (dateIdx === -1 || titleIdx === -1 || amountIdx === -1) return [];

  const result: StatementRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const date = row[dateIdx]?.trim();
    const title = row[titleIdx]?.trim();
    const rawAmount = row[amountIdx]?.trim();
    if (!date || !title || !rawAmount) continue;
    const amount = parseSignedAmountBR(rawAmount);
    if (amount === null || amount === 0) continue;
    result.push({ date, title, amount });
  }
  return result;
}

export interface BankReconcileRow {
  date: string;
  description: string;
  amount: number; // valor absoluto
  type: "income" | "expense";
  alreadyExists: boolean;
}

export interface BankReconcileResult {
  rows: BankReconcileRow[];
  toImport: Omit<Transaction, "id">[];
  alreadyCount: number;
}

// Concilia um extrato de conta (nao cartao) contra os lancamentos ja
// existentes. Casa por VALOR + tipo + mesmo mes (nao exige data exata, pois
// lancamentos manuais podem ter data aproximada), consumindo cada
// lancamento existente no maximo uma vez.
export function reconcileBankStatement(
  csvText: string,
  existingTransactions: Transaction[],
  incomeCategoryId: string,
  expenseCategoryId: string,
): BankReconcileResult {
  const parsed = parseStatementCsv(csvText);

  const accountTx = existingTransactions.filter((t) => t.paymentMethod === "account");
  const usedIds = new Set<string>();

  function findMatch(
    yearMonth: string,
    type: "income" | "expense",
    amount: number,
  ): Transaction | undefined {
    return accountTx.find(
      (t) =>
        !usedIds.has(t.id) &&
        t.type === type &&
        t.date.slice(0, 7) === yearMonth &&
        Math.abs(t.amount - amount) < 0.005,
    );
  }

  const rows: BankReconcileRow[] = [];
  const toImport: Omit<Transaction, "id">[] = [];

  for (const row of parsed) {
    const type: "income" | "expense" = row.amount >= 0 ? "income" : "expense";
    const amount = Math.abs(row.amount);
    const yearMonth = row.date.slice(0, 7);

    const match = findMatch(yearMonth, type, amount);
    const alreadyExists = !!match;
    if (match) usedIds.add(match.id);

    rows.push({ date: row.date, description: row.title, amount, type, alreadyExists });

    if (!alreadyExists) {
      toImport.push({
        date: row.date,
        description: row.title,
        amount,
        type,
        categoryId: type === "income" ? incomeCategoryId : expenseCategoryId,
        paymentMethod: "account",
        settled: row.date <= todayIso(),
      });
    }
  }

  return { rows, toImport, alreadyCount: rows.filter((r) => r.alreadyExists).length };
}
