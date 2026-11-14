/** Public daily trade activity contains counts only — never PnL, symbols or private orders. */
export type PublicDailyCounts = {
  day: string;
  count: number;
  wins: number;
  losses: number;
  flat: number;
};
export type PublicDailyHistoryPayload = {
  days: 30;
  timezone: "UTC";
  through: string;
  items: PublicDailyCounts[];
};

function utcDate(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const ms = Date.parse(value + "T00:00:00.000Z");
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) return null;
  return ms;
}

/** Fill missing imported dates with zero *imported closes*, not synthetic trading outcomes. */
export function publicDailyTimeline(payload: PublicDailyHistoryPayload): PublicDailyCounts[] {
  const end = utcDate(payload.through);
  if (payload.days !== 30 || payload.timezone !== "UTC" || end === null) return [];
  const byDate = new Map<string, PublicDailyCounts>();
  for (const row of Array.isArray(payload.items) ? payload.items.slice(0, 100) : []) {
    const timestamp = utcDate(row?.day);
    if (timestamp === null || timestamp > end || timestamp < end - 29 * 86400_000 ||
      ![row.count, row.wins, row.losses, row.flat].every(value => Number.isSafeInteger(value) && value >= 0) ||
      row.count !== row.wins + row.losses + row.flat || byDate.has(row.day)) continue;
    byDate.set(row.day, { day: row.day, count: row.count, wins: row.wins, losses: row.losses, flat: row.flat });
  }
  return Array.from({ length: 30 }, (_, index) => {
    const day = new Date(end - (29 - index) * 86400_000).toISOString().slice(0, 10);
    return byDate.get(day) ?? { day, count: 0, wins: 0, losses: 0, flat: 0 };
  });
}
