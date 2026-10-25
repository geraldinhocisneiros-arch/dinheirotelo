import type { Transaction } from "@/lib/types";
import { addMonthsIso } from "@/lib/date";
import { todayIso } from "@/lib/format";

// Divide uma compra parcelada no cartao em N lancamentos, um por mes a partir
// da data da compra. O valor informado e o TOTAL da compra; os centavos que
// sobram da divisao vao pra primeira parcela (como as operadoras fazem). A
// descricao segue o formato do extrato do Nubank ("X - Parcela 2/6") pra
// conciliacao reconhecer as parcelas ja lancadas e nao duplicar.
export function splitInstallments(
  base: Omit<Transaction, "id">,
  count: number,
): Omit<Transaction, "id">[] {
  const totalCents = Math.round(base.amount * 100);
  const partCents = Math.floor(totalCents / count);
  const firstCents = totalCents - partCents * (count - 1);
  const description = base.description.trim();

  return Array.from({ length: count }, (_, i) => {
    const date = addMonthsIso(base.date, i);
    return {
      ...base,
      date,
      description: `${description} - Parcela ${i + 1}/${count}`,
      amount: (i === 0 ? firstCents : partCents) / 100,
      settled: date <= todayIso(),
    };
  });
}
