export interface QuoteInput {
  widthM: number;
  heightM: number;
  ratePerSqm: number;
  prepHours: number;
  prepRate: number;
  travelKm: number;
  travelRate: number;
  designFee: number;
  equipment: number;
  contingencyPct: number;
  taxPct: number;
  currency: string;
}

export interface QuoteLine {
  label: string;
  detail: string;
  amount: number;
}

export interface QuoteResult {
  areaSqm: number;
  lines: QuoteLine[];
  subtotal: number;
  contingency: number;
  tax: number;
  total: number;
  currency: string;
}

export const DEFAULT_QUOTE: QuoteInput = {
  widthM: 12,
  heightM: 6,
  ratePerSqm: 180,
  prepHours: 8,
  prepRate: 85,
  travelKm: 40,
  travelRate: 1.1,
  designFee: 950,
  equipment: 1200,
  contingencyPct: 10,
  taxPct: 10,
  currency: "AUD",
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeQuote(input: QuoteInput): QuoteResult {
  const n = (v: number) => (Number.isFinite(v) ? v : 0);
  const areaSqm = round2(n(input.widthM) * n(input.heightM));

  const lines: QuoteLine[] = [
    {
      label: "Mural painting",
      detail: `${areaSqm} m² × ${formatMoney(n(input.ratePerSqm), input.currency)}/m²`,
      amount: areaSqm * n(input.ratePerSqm),
    },
    {
      label: "Surface preparation",
      detail: `${n(input.prepHours)} h × ${formatMoney(n(input.prepRate), input.currency)}/h`,
      amount: n(input.prepHours) * n(input.prepRate),
    },
    {
      label: "Design & concept",
      detail: "Concept development, mockups, revisions",
      amount: n(input.designFee),
    },
    {
      label: "Access equipment",
      detail: "Scaffold / boom lift hire",
      amount: n(input.equipment),
    },
    {
      label: "Travel",
      detail: `${n(input.travelKm)} km × ${formatMoney(n(input.travelRate), input.currency)}/km`,
      amount: n(input.travelKm) * n(input.travelRate),
    },
  ]
    .filter((l) => l.amount > 0)
    .map((l) => ({ ...l, amount: round2(l.amount) }));

  const subtotal = round2(lines.reduce((s, l) => s + l.amount, 0));
  const contingency = round2((subtotal * n(input.contingencyPct)) / 100);
  const tax = round2(((subtotal + contingency) * n(input.taxPct)) / 100);
  const total = round2(subtotal + contingency + tax);

  return { areaSqm, lines, subtotal, contingency, tax, total, currency: input.currency };
}

export function formatMoney(amount: number, currency: string): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "AUD",
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    return `${currency} ${safe.toFixed(2)}`;
  }
}

/** One-line investment summary for the proposal cover. */
export function quoteSummary(q: QuoteResult): string {
  return `${formatMoney(q.total, q.currency)} ${q.currency} incl. tax`;
}
