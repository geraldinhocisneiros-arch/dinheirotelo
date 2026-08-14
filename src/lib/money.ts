export function parseAmountBR(raw: string): number | null {
  const n = parseSignedAmountBR(raw);
  return n === null ? null : Math.abs(n);
}

// Preserva o sinal (positivo = entrada, negativo = saida), diferente de
// parseAmountBR que sempre retorna um valor absoluto.
export function parseSignedAmountBR(raw: string): number | null {
  let s = raw.trim().replace(/r\$/i, "").trim();
  let negative = false;
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1).trim();
  } else if (s.startsWith("(") && s.endsWith(")")) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  s = s.replace(/[^\d.]/g, "");
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}
