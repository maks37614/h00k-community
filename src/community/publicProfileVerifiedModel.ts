/** Display-only projection of opt-in Community aggregates. Never infer a rank. */
export type PublicAwardsAggregate = {
  received: number;
  thanks: number;
  analysis: number;
  topTrader: number;
};

export type PublicAwardCard = {
  id: "thanks" | "analysis" | "topTrader";
  title: string;
  description: string;
  count: number;
};

const AWARD_KINDS = [
  { id: "thanks", title: "Подяка", description: "Подяки від учасників Community" },
  { id: "analysis", title: "Крутий аналіз", description: "Отримані відзнаки за аналіз" },
  { id: "topTrader", title: "Топ трейдер", description: "Отримані нагороди цієї категорії" },
] as const;

function validCount(value: unknown): number {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : 0;
}

/** Return only types with positive, verified server counts — no mock badges. */
export function publicAwardCards(input: PublicAwardsAggregate): PublicAwardCard[] {
  return AWARD_KINDS.filter(kind => validCount(input[kind.id]) > 0)
    .map(kind => ({ ...kind, count: validCount(input[kind.id]) }));
}

export type PublicStatsCoverage = {
  status?: string;
  synced_at?: string | null;
  covered_from?: string | null;
};

export type PublicStatsFreshness = {
  lastSyncedAt: string | null;
  earliestCoveredFrom: string | null;
};

function validTime(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}

/** Only dates supplied by actual server-side connection coverage are shown. */
export function publicStatsFreshness(rows: readonly PublicStatsCoverage[]): PublicStatsFreshness {
  const synced = rows.map(row => validTime(row.synced_at)).filter((v): v is number => v !== null);
  const from = rows.map(row => validTime(row.covered_from)).filter((v): v is number => v !== null);
  return {
    lastSyncedAt: synced.length ? new Date(Math.max(...synced)).toISOString() : null,
    earliestCoveredFrom: from.length ? new Date(Math.min(...from)).toISOString() : null,
  };
}
