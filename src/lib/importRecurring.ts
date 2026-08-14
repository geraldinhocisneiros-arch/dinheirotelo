import type { Category, EntryType, PaymentMethod, RecurringTemplate } from "@/lib/types";
import { parseCSV } from "@/lib/csv";
import { parseAmountBR } from "@/lib/money";

const HEADER_ALIASES = {
  description: ["descricao", "descrição", "description", "desc"],
  amount: ["valor", "amount", "value"],
  type: ["tipo", "type"],
  category: ["categoria", "category"],
  paymentMethod: [
    "forma_pagamento",
    "forma de pagamento",
    "pagamento",
    "payment",
    "payment_method",
  ],
  dayOfMonth: ["dia_do_mes", "dia do mes", "dia", "day", "dayofmonth", "day_of_month"],
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

function parseType(raw: string): EntryType {
  const s = normalize(raw);
  return ["entrada", "income", "receita"].includes(s) ? "income" : "expense";
}

function parsePaymentMethod(raw: string | undefined): PaymentMethod {
  if (!raw) return "account";
  const s = normalize(raw);
  return s.includes("cartao") || s.includes("credit") ? "credit_card" : "account";
}

const PALETTE = [
  "#f59e0b", "#ef4444", "#6366f1", "#0ea5e9", "#ec4899",
  "#8b5cf6", "#14b8a6", "#78716c", "#16a34a", "#2563eb",
];

export interface RecurringImportResult {
  templates: Omit<RecurringTemplate, "id">[];
  newCategories: Category[];
  errors: string[];
}

export function importRecurringFromCsv(
  text: string,
  existingCategories: Category[],
): RecurringImportResult {
  const rows = parseCSV(text);
  if (rows.length === 0) {
    return { templates: [], newCategories: [], errors: ["Arquivo vazio."] };
  }

  const headers = rows[0];
  const idx = {
    description: findColumnIndex(headers, "description"),
    amount: findColumnIndex(headers, "amount"),
    type: findColumnIndex(headers, "type"),
    category: findColumnIndex(headers, "category"),
    paymentMethod: findColumnIndex(headers, "paymentMethod"),
    dayOfMonth: findColumnIndex(headers, "dayOfMonth"),
  };

  const errors: string[] = [];
  if (idx.description === -1 || idx.amount === -1 || idx.dayOfMonth === -1) {
    errors.push(
      "Não encontrei as colunas obrigatórias (descrição, valor, dia_do_mes).",
    );
    return { templates: [], newCategories: [], errors };
  }

  const categories = [...existingCategories];
  const newCategories: Category[] = [];
  const templates: Omit<RecurringTemplate, "id">[] = [];

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
    const rawDesc = row[idx.description] ?? "";
    const rawAmount = row[idx.amount] ?? "";
    const rawType = idx.type !== -1 ? (row[idx.type] ?? "") : "";
    const rawCategory = idx.category !== -1 ? (row[idx.category] ?? "") : "";
    const rawPayment = idx.paymentMethod !== -1 ? row[idx.paymentMethod] : undefined;
    const rawDay = row[idx.dayOfMonth] ?? "";

    const amount = parseAmountBR(rawAmount);
    const dayOfMonth = parseInt(rawDay, 10);
    if (!rawDesc.trim() || amount === null || amount <= 0 || !Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
      errors.push(`Linha ${lineNo}: dados inválidos, pulei.`);
      continue;
    }

    const type = parseType(rawType);
    const paymentMethod = type === "income" ? "account" : parsePaymentMethod(rawPayment);
    const categoryId = resolveCategory(rawCategory, type);

    templates.push({
      description: rawDesc.trim(),
      amount,
      type,
      categoryId,
      paymentMethod,
      dayOfMonth,
      active: true,
    });
  }

  return { templates, newCategories, errors };
}
