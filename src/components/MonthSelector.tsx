import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatYearMonth } from "@/lib/fatura";
import { shiftMonth } from "@/lib/date";

export { shiftMonth };

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
