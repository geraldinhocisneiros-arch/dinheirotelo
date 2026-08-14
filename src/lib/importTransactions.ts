import type { Category, EntryType, PaymentMethod, Transaction } from "@/lib/types";
import { parseCSV } from "@/lib/csv";

const HEADER_ALIASES = {
  date: ["data", "date"],
  description: ["descricao", "descrição", "description", "desc", "titulo", "título"],
  amount: ["valor", "amount", "value"],
  type: ["tipo", "type"],
  category: ["categoria", "category"],
  paymentMethod: [
    "forma_pagamento",
    "forma de pagamento",
    "pagamento",
    "payment",
    "payment_method",
    "metodo de pagamento",
    "método de pagamento",
  ],
} as const;

type HeaderKey = keyof typeof HEADER_ALIASES;

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function findColumnIndex(headers: string[], key: HeaderKey): number {
  const aliases = HEADER_ALIASES[key].map(normalize);
  return headers.findIndex((h) => aliases.includes(normalize(h)));
}

function parseDate(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

function parseAmount(raw: string): number | null {
  let s = raw.trim().replace(/r\$/i, "").trim();
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  s = s.replace(/[^\d.-]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.abs(n) : null;
}

function parseType(raw: string): EntryType {
  const s = normalize(raw);
  return ["entrada", "income", "receita", "credito", "credit"].includes(s)
    ? "income"
    : "expense";
}

function parsePaymentMethod(raw: string | undefined): PaymentMethod {
  if (!raw) return "account";
  const s = normalize(raw);
  const cardHints = ["cartao", "cartao de credito", "credit_card", "credito", "credit card"];
  return cardHints.some((hint) => s.includes(normalize(hint))) ? "credit_card" : "account";
}

const PALETTE = [
  "#f59e0b",
  "#ef4444",
  "#6366f1",
  "#0ea5e9",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
  "#78716c",
  "#16a34a",
  "#2563eb",
];

export interface ImportResult {
  transactions: Omit<Transaction, "id">[];
  newCategories: Category[];
  errors: string[];
}

export function importTransactionsFromCsv(
  text: string,
  existingCategories: Category[],
): ImportResult {
  const rows = parseCSV(text);
  if (rows.length === 0) {
    return { transactions: [], newCategories: [], errors: ["Arquivo vazio."] };
  }

  const headers = rows[0];
  const idx = {
    date: findColumnIndex(headers, "date"),
    description: findColumnIndex(headers, "description"),
    amount: findColumnIndex(headers, "amount"),
    type: findColumnIndex(headers, "type"),
    category: findColumnIndex(headers, "category"),
    paymentMethod: findColumnIndex(headers, "paymentMethod"),
  };

  const errors: string[] = [];
  if (idx.date === -1 || idx.description === -1 || idx.amount === -1) {
    errors.push(
      "Não encontrei as colunas obrigatórias (data, descrição, valor). Verifique o cabeçalho do CSV.",
    );
    return { transactions: [], newCategories: [], errors };
  }

  const categories = [...existingCategories];
  const newCategories: Category[] = [];
  const transactions: Omit<Transaction, "id">[] = [];

  function resolveCategory(name: string, type: EntryType): string {
    const trimmed = name.trim();
    const label = trimmed || (type === "income" ? "Outras receitas" : "Outras despesas");
    const found = categories.find(
      (c) => c.type === type && normalize(c.name) === normalize(label),
    );
    if (found) return found.id;
    const created: Category = {
      id: `cat-import-${categories.length}-${Math.random().toString(36).slice(2, 7)}`,
      name: label,
      type,
      color: PALETTE[categories.length % PALETTE.length],
    };
    categories.push(created);
    newCategories.push(created);
    return created.id;
  }

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const lineNo = r + 1;
    const rawDate = row[idx.date] ?? "";
    const rawDesc = row[idx.description] ?? "";
    const rawAmount = row[idx.amount] ?? "";
    const rawType = idx.type !== -1 ? (row[idx.type] ?? "") : "";
    const rawCategory = idx.category !== -1 ? (row[idx.category] ?? "") : "";
    const rawPayment = idx.paymentMethod !== -1 ? row[idx.paymentMethod] : undefined;

    const date = parseDate(rawDate);
    const amount = parseAmount(rawAmount);
    if (!date || !rawDesc.trim() || amount === null || amount <= 0) {
      errors.push(`Linha ${lineNo}: dados inválidos, pulei.`);
      continue;
    }

    const type = parseType(rawType);
    const paymentMethod = type === "income" ? "account" : parsePaymentMethod(rawPayment);
    const categoryId = resolveCategory(rawCategory, type);

    transactions.push({ date, description: rawDesc.trim(), amount, type, categoryId, paymentMethod });
  }

  return { transactions, newCategories, errors };
}
