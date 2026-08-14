import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatYearMonth } from "@/lib/fatura";

export function shiftMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function MonthSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (yearMonth: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(shiftMonth(value, -1))}
        aria-label="Mês anterior"
        className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface)] transition-colors"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="min-w-32 text-center text-sm font-medium capitalize">
        {formatYearMonth(value)}
      </span>
      <button
        onClick={() => onChange(shiftMonth(value, 1))}
        aria-label="Próximo mês"
        className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface)] transition-colors"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
