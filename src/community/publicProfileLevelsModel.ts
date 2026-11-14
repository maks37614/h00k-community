import type { ChartDocument } from "./chartDocument";

export type PublicSnapshotLevel = {
  kind: "entry" | "stop_loss" | "target" | "neckline";
  label: string;
  price: number;
};

export type PublicSnapshotLevelSummary = {
  levels: PublicSnapshotLevel[];
  extra: number;
};

const DISPLAY_LIMITS = { entry: 2, stop_loss: 2, target: 3, neckline: 1 } as const;
const LEVEL_ORDER = ["entry", "stop_loss", "target", "neckline"] as const;

/**
 * Present marker levels *as authored in the authorized saved document*.
 * Never infer levels, direction, R:R, quality score or trade execution.
 * Bounded for small mobile cards even when a snapshot contains 100 markers.
 */
export function publicSnapshotLevels(document: Pick<ChartDocument, "markers">): PublicSnapshotLevelSummary {
  const valid = document.markers.filter((marker) =>
    (LEVEL_ORDER as readonly string[]).includes(marker.type) &&
    typeof marker.price === "number" && Number.isFinite(marker.price) && marker.price > 0,
  );
  const levels: PublicSnapshotLevel[] = [];
  for (const kind of LEVEL_ORDER) {
    const matches = valid.filter(marker => marker.type === kind);
    const display = matches.slice(0, DISPLAY_LIMITS[kind]);
    display.forEach((marker, index) => {
      const name = kind === "entry" ? "Entry"
        : kind === "stop_loss" ? "SL"
        : kind === "target" ? "TP"
        : "Neckline";
      const numbered = kind === "target" || matches.length > 1 && kind !== "neckline";
      levels.push({ kind, label: name + (numbered ? String(index + 1) : ""), price: marker.price });
    });
  }
  return { levels, extra: valid.length - levels.length };
}

/** Keep low-priced crypto levels readable; do not silently render them as zero. */
export function formatPublicSnapshotPrice(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 12 }).format(price);
}
