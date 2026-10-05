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
  // Pagamento parcial (adiantado) da fatura do cartao desse mes ("2026-10").
  // E uma saida de conta normal - sai do saldo na data do pagamento - e
  // abate o que ainda falta pagar daquela fatura.
  faturaPartialOf?: string;
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
  // Meses ("2026-10") em que o lancamento desse recorrente foi apagado de
  // proposito - nao sao gerados de novo nem contam na projecao.
  skippedMonths?: string[];
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
