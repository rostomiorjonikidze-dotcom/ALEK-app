// Shared deterministic monetary calculations. Do not let the AI invent totals.
export type PriceLine = {
  priceType: "total" | "unit" | "hourly";
  quantity: number;
  price: number;
  hours: number;
};

export function serviceTotal(item: PriceLine): number {
  const price = Number(item.price) || 0;
  const quantity = Number(item.quantity) || 0;
  const hours = Number(item.hours) || 0;
  const raw = item.priceType === "hourly" ? hours * price
    : item.priceType === "unit" ? quantity * price : price;
  return Math.round((raw + Number.EPSILON) * 100) / 100;
}

/**
 * An explicit French phrase like "2 contrats à 1000 euros" denotes
 * a unit price, unlike "2 contrats pour 1000 euros au total".
 * Only correct a one-line AI result when both parsed numbers agree.
 */
export function inferUnitPrices<T extends PriceLine>(original: string, lines: T[]): T[] {
  if (lines.length !== 1) return lines;
  const parsed = original.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s+(?:[\p{L}'’-]+\s+){1,5}à\s+(\d+(?:[.,]\d+)?)\s*(?:€|euros?)(?!\p{L})/iu);
  if (!parsed || /\b(?:au total|prix global|forfait total)\b/i.test(original)) return lines;
  const q = Number(parsed[1].replace(",", "."));
  const p = Number(parsed[2].replace(",", "."));
  const line = lines[0];
  if (line.priceType === "total" && q > 1 && q === line.quantity && p === line.price) {
    return [{ ...line, priceType: "unit" }];
  }
  return lines;
}
