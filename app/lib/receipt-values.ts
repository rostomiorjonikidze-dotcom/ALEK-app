export function receiptNumberOrNull(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = typeof value === "number" ? value : Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : null;
}
