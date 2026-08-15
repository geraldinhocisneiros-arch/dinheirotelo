import { useFinanceStore } from "@/store/useFinanceStore";

export interface BackupData {
  categories: unknown;
  transactions: unknown;
  recurringTemplates: unknown;
  budgets: unknown;
  faturaPayments: unknown;
}

export function exportBackup(): string {
  const s = useFinanceStore.getState();
  const data: BackupData = {
    categories: s.categories,
    transactions: s.transactions,
    recurringTemplates: s.recurringTemplates,
    budgets: s.budgets,
    faturaPayments: s.faturaPayments,
  };
  return JSON.stringify(data, null, 2);
}

export function parseBackup(text: string): BackupData {
  const data = JSON.parse(text);
  if (!data || typeof data !== "object" || !Array.isArray(data.transactions)) {
    throw new Error("Arquivo de backup inválido.");
  }
  return {
    categories: Array.isArray(data.categories) ? data.categories : [],
    transactions: data.transactions,
    recurringTemplates: Array.isArray(data.recurringTemplates)
      ? data.recurringTemplates
      : [],
    budgets: Array.isArray(data.budgets) ? data.budgets : [],
    faturaPayments: Array.isArray(data.faturaPayments) ? data.faturaPayments : [],
  };
}

export function applyBackup(data: BackupData): void {
  useFinanceStore.setState({
    categories: data.categories as never,
    transactions: data.transactions as never,
    recurringTemplates: data.recurringTemplates as never,
    budgets: data.budgets as never,
    faturaPayments: data.faturaPayments as never,
  });
}
