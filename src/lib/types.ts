export type EntryType = "income" | "expense";
export type PaymentMethod = "account" | "credit_card";

export interface Category {
  id: string;
  name: string;
  type: EntryType;
  color: string;
}

export interface Transaction {
  id: string;
  date: string; // ISO yyyy-MM-dd
  description: string;
  amount: number;
  type: EntryType;
  categoryId: string;
  paymentMethod: PaymentMethod;
  recurringTemplateId?: string;
  // Se ja foi efetivamente recebido/pago (baixado). So conta pro saldo atual
  // quando true - a data e so o planejamento, isso aqui e a realidade.
  settled: boolean;
}

export interface RecurringTemplate {
  id: string;
  description: string;
  amount: number;
  type: EntryType;
  categoryId: string;
  paymentMethod: PaymentMethod;
  dayOfMonth: number;
  active: boolean;
}

export interface Budget {
  categoryId: string;
  monthlyLimit: number;
}

export interface FaturaPayment {
  yearMonth: string; // "2026-08"
  paid: boolean;
  paidDate?: string;
}
