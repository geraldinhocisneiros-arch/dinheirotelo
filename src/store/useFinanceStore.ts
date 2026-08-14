import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Budget,
  Category,
  FaturaPayment,
  RecurringTemplate,
  Transaction,
} from "@/lib/types";
import { todayIso } from "@/lib/format";

function uid(): string {
  return crypto.randomUUID();
}

const defaultCategories: Category[] = [
  { id: "cat-salario", name: "Salário", type: "income", color: "#16a34a" },
  { id: "cat-outros-receita", name: "Outras receitas", type: "income", color: "#22c55e" },
  { id: "cat-feira", name: "Feira", type: "expense", color: "#f59e0b" },
  { id: "cat-gasolina", name: "Gasolina", type: "expense", color: "#ef4444" },
  { id: "cat-moradia", name: "Moradia", type: "expense", color: "#6366f1" },
  { id: "cat-transporte", name: "Transporte", type: "expense", color: "#0ea5e9" },
  { id: "cat-saude", name: "Saúde", type: "expense", color: "#ec4899" },
  { id: "cat-lazer", name: "Lazer", type: "expense", color: "#8b5cf6" },
  { id: "cat-assinaturas", name: "Assinaturas", type: "expense", color: "#14b8a6" },
  { id: "cat-outros-despesa", name: "Outras despesas", type: "expense", color: "#78716c" },
];

const defaultBudgets: Budget[] = [
  { categoryId: "cat-feira", monthlyLimit: 1200 },
  { categoryId: "cat-gasolina", monthlyLimit: 700 },
];

type NewTransaction = Omit<Transaction, "id" | "settled"> & { settled?: boolean };

interface FinanceState {
  categories: Category[];
  transactions: Transaction[];
  recurringTemplates: RecurringTemplate[];
  budgets: Budget[];
  faturaPayments: FaturaPayment[];

  addTransaction: (t: NewTransaction) => void;
  updateTransaction: (id: string, t: Omit<Transaction, "id">) => void;
  removeTransaction: (id: string) => void;
  removeAllTransactions: () => void;
  setTransactionSettled: (id: string, settled: boolean) => void;
  importTransactions: (
    newCategories: Category[],
    newTransactions: NewTransaction[],
  ) => void;

  addCategory: (c: Omit<Category, "id">) => void;
  removeCategory: (id: string) => void;

  addRecurringTemplate: (r: Omit<RecurringTemplate, "id">) => void;
  updateRecurringTemplate: (id: string, r: Omit<RecurringTemplate, "id">) => void;
  removeRecurringTemplate: (id: string) => void;
  launchRecurring: (id: string, date: string) => void;

  setBudget: (categoryId: string, monthlyLimit: number) => void;
  removeBudget: (categoryId: string) => void;

  setFaturaPaid: (yearMonth: string, paid: boolean, total: number) => void;
}

function withSettled(t: NewTransaction): Transaction {
  return { ...t, id: uid(), settled: t.settled ?? t.date <= todayIso() };
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set, get) => ({
      categories: defaultCategories,
      transactions: [],
      recurringTemplates: [],
      budgets: defaultBudgets,
      faturaPayments: [],

      addTransaction: (t) =>
        set((state) => ({
          transactions: [...state.transactions, withSettled(t)],
        })),

      updateTransaction: (id, t) =>
        set((state) => ({
          transactions: state.transactions.map((tx) =>
            tx.id === id ? { ...t, id } : tx,
          ),
        })),

      removeTransaction: (id) =>
        set((state) => ({
          transactions: state.transactions.filter((tx) => tx.id !== id),
        })),

      removeAllTransactions: () =>
        set(() => ({ transactions: [], faturaPayments: [] })),

      setTransactionSettled: (id, settled) =>
        set((state) => ({
          transactions: state.transactions.map((tx) =>
            tx.id === id ? { ...tx, settled } : tx,
          ),
        })),

      importTransactions: (newCategories, newTransactions) =>
        set((state) => ({
          categories: [...state.categories, ...newCategories],
          transactions: [
            ...state.transactions,
            ...newTransactions.map(withSettled),
          ],
        })),

      addCategory: (c) =>
        set((state) => ({
          categories: [...state.categories, { ...c, id: uid() }],
        })),

      removeCategory: (id) =>
        set((state) => ({
          categories: state.categories.filter((c) => c.id !== id),
        })),

      addRecurringTemplate: (r) =>
        set((state) => ({
          recurringTemplates: [
            ...state.recurringTemplates,
            { ...r, id: uid() },
          ],
        })),

      updateRecurringTemplate: (id, r) =>
        set((state) => ({
          recurringTemplates: state.recurringTemplates.map((rt) =>
            rt.id === id ? { ...r, id } : rt,
          ),
        })),

      removeRecurringTemplate: (id) =>
        set((state) => ({
          recurringTemplates: state.recurringTemplates.filter(
            (rt) => rt.id !== id,
          ),
        })),

      launchRecurring: (id, date) => {
        const template = get().recurringTemplates.find((rt) => rt.id === id);
        if (!template) return;
        get().addTransaction({
          date,
          description: template.description,
          amount: template.amount,
          type: template.type,
          categoryId: template.categoryId,
          paymentMethod: template.paymentMethod,
          recurringTemplateId: template.id,
        });
      },

      setBudget: (categoryId, monthlyLimit) =>
        set((state) => {
          const exists = state.budgets.some((b) => b.categoryId === categoryId);
          return {
            budgets: exists
              ? state.budgets.map((b) =>
                  b.categoryId === categoryId ? { ...b, monthlyLimit } : b,
                )
              : [...state.budgets, { categoryId, monthlyLimit }],
          };
        }),

      removeBudget: (categoryId) =>
        set((state) => ({
          budgets: state.budgets.filter((b) => b.categoryId !== categoryId),
        })),

      setFaturaPaid: (yearMonth, paid, total) =>
        set((state) => {
          const exists = state.faturaPayments.some(
            (f) => f.yearMonth === yearMonth,
          );
          const paidDate = paid ? todayIso() : undefined;
          return {
            faturaPayments: exists
              ? state.faturaPayments.map((f) =>
                  f.yearMonth === yearMonth ? { ...f, paid, paidDate } : f,
                )
              : [...state.faturaPayments, { yearMonth, paid, paidDate }],
            transactions: paid
              ? [
                  ...state.transactions,
                  {
                    id: uid(),
                    date: paidDate!,
                    description: `Fatura do cartão ${yearMonth}`,
                    amount: total,
                    type: "expense",
                    categoryId: "cat-outros-despesa",
                    paymentMethod: "account" as const,
                    settled: true,
                  },
                ]
              : state.transactions.filter(
                  (tx) => tx.description !== `Fatura do cartão ${yearMonth}`,
                ),
          };
        }),
    }),
    {
      name: "financas-casa-store",
      version: 1,
      migrate: (persistedState, version) => {
        const state = persistedState as FinanceState;
        if (version < 1 && Array.isArray(state?.transactions)) {
          const today = todayIso();
          state.transactions = state.transactions.map((tx) =>
            typeof tx.settled === "boolean" ? tx : { ...tx, settled: tx.date <= today },
          );
        }
        return state;
      },
    },
  ),
);
