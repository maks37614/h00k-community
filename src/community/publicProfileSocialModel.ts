/** Public-only presentation helpers. Never infer trading returns not delivered by API. */
export type ClosedOrderSummary = {
  currency: string;
  count: number;
  wins: number;
  losses: number;
  flat: number;
  winRate: number | null;
  pnl?: string;
};

export type ClosedOrderOverview = {
  count: number;
  wins: number;
  losses: number;
  flat: number;
  winRate: number | null;
  pnl: string | null;
  currency: string | null;
};

export function publicClosedOrderOverview(totals: readonly ClosedOrderSummary[]): ClosedOrderOverview {
  const valid = totals.filter((row) =>
    Number.isInteger(row.count) && row.count >= 0 &&
    Number.isInteger(row.wins) && row.wins >= 0 &&
    Number.isInteger(row.losses) && row.losses >= 0 &&
    Number.isInteger(row.flat) && row.flat >= 0,
  );
  const count = valid.reduce((sum, row) => sum + row.count, 0);
  const wins = valid.reduce((sum, row) => sum + row.wins, 0);
  const losses = valid.reduce((sum, row) => sum + row.losses, 0);
  const flat = valid.reduce((sum, row) => sum + row.flat, 0);
  const source = valid.length === 1 ? valid[0] : null;
  return {
    count, wins, losses, flat,
    winRate: wins + losses ? 100 * wins / (wins + losses) : null,
    // PnL across different currencies must never be added into one fake amount.
    pnl: source?.pnl === undefined ? null : source.pnl,
    currency: source?.pnl === undefined ? null : source.currency,
  };
}

export function publicProfileSetups<T extends { chart: unknown }>(posts: readonly T[]): T[] {
  return posts.filter((item) => item.chart !== null && item.chart !== undefined);
}
