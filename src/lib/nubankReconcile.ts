import type { Transaction } from "@/lib/types";
import { parseCSV } from "@/lib/csv";
import { parseAmountBR } from "@/lib/money";
import { faturaYearMonth } from "@/lib/fatura";
import { todayIso } from "@/lib/format";

interface NubankRow {
  date: string;
  title: string;
  amount: number;
  baseDescription: string;
  installmentCurrent?: number;
  installmentTotal?: number;
}

const PARCELA_RE = /\s*-\s*Parcela\s+(\d+)\/(\d+)\s*$/i;

function parseNubankCsv(text: string): NubankRow[] {
  const rows = parseCSV(text);
  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const dateIdx = headers.indexOf("date");
  const titleIdx = headers.indexOf("title");
  const amountIdx = headers.indexOf("amount");
  if (dateIdx === -1 || titleIdx === -1 || amountIdx === -1) return [];

  const result: NubankRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const date = row[dateIdx]?.trim();
    const title = row[titleIdx]?.trim();
    const rawAmount = row[amountIdx]?.trim();
    if (!date || !title || !rawAmount) continue;
    const amount = parseAmountBR(rawAmount);
    if (amount === null) continue;

    const m = title.match(PARCELA_RE);
    result.push({
      date,
      title,
      amount,
      baseDescription: m ? title.slice(0, m.index).trim() : title,
      installmentCurrent: m ? Number(m[1]) : undefined,
      installmentTotal: m ? Number(m[2]) : undefined,
    });
  }
  return result;
}

function addMonths(dateIso: string, months: number): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const date = new Date(y, m - 1 + months, d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export interface ReconcileRow {
  date: string;
  description: string;
  amount: number;
  faturaMonth: string;
  alreadyExists: boolean;
  isFutureInstallment: boolean;
}

export interface ReconcileResult {
  rows: ReconcileRow[];
  toImport: Omit<Transaction, "id">[];
  alreadyCount: number;
}

export function reconcileNubankCsv(
  csvText: string,
  existingTransactions: Transaction[],
  defaultCategoryId: string,
): ReconcileResult {
  const parsed = parseNubankCsv(csvText);

  const seen = new Set(
    existingTransactions
      .filter((t) => t.paymentMethod === "credit_card")
      .map((t) => `${t.date}|${t.amount.toFixed(2)}`),
  );

  const rows: ReconcileRow[] = [];
  const toImport: Omit<Transaction, "id">[] = [];

  function addRow(date: string, description: string, amount: number, isFuture: boolean) {
    const key = `${date}|${amount.toFixed(2)}`;
    const alreadyExists = seen.has(key);
    rows.push({
      date,
      description,
      amount,
      faturaMonth: faturaYearMonth(date),
      alreadyExists,
      isFutureInstallment: isFuture,
    });
    if (!alreadyExists) {
      seen.add(key);
      toImport.push({
        date,
        description,
        amount,
        type: "expense",
        categoryId: defaultCategoryId,
        paymentMethod: "credit_card",
        settled: date <= todayIso(),
      });
    }
  }

  for (const row of parsed) {
    addRow(row.date, row.title, row.amount, false);

    if (
      row.installmentCurrent !== undefined &&
      row.installmentTotal !== undefined &&
      row.installmentCurrent < row.installmentTotal
    ) {
      for (let k = row.installmentCurrent + 1; k <= row.installmentTotal; k++) {
        const futureDate = addMonths(row.date, k - row.installmentCurrent);
        const desc = `${row.baseDescription} - Parcela ${k}/${row.installmentTotal}`;
        addRow(futureDate, desc, row.amount, true);
      }
    }
  }

  return {
    rows,
    toImport,
    alreadyCount: rows.filter((r) => r.alreadyExists).length,
  };
}
