// Compras ate o dia 8 entram na fatura do mes corrente; a partir do dia 9,
// entram na fatura do mes seguinte.
export function faturaYearMonth(purchaseDateIso: string): string {
  const [y, m, d] = purchaseDateIso.split("-").map(Number);
  const day = d;
  let year = y;
  let month = m; // 1-12

  if (day >= 9) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return `${year}-${String(month).padStart(2, "0")}`;
}

export function formatYearMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
