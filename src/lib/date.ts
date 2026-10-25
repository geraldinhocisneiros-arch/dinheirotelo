export function shiftMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function daysInMonth(yearMonth: string): number {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

// Soma meses a uma data ISO mantendo o dia; se o mes de destino for mais
// curto (ex: 31/01 + 1 mes), usa o ultimo dia dele em vez de pular pro mes
// seguinte.
export function addMonthsIso(dateIso: string, months: number): string {
  const yearMonth = shiftMonth(dateIso.slice(0, 7), months);
  const day = Math.min(Number(dateIso.slice(8, 10)), daysInMonth(yearMonth));
  return `${yearMonth}-${String(day).padStart(2, "0")}`;
}
