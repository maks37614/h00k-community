import { captureChartDocument, type ChartDocument, TF_SECONDS } from "./chartDocument";
import { normalizeArchiveScoreProof } from "./archiveScoreProof";

/**
 * Short-lived, explicit opt-in from the owner's h00k archive. This packet is
 * untrusted browser input. It populates an EDITABLE DRAFT only, never posts.
 * The Community server independently checks qualityProof on chart save.
 */
export function chartFromScreenerHandoff(token: string, now = Date.now()): ChartDocument {
  if (typeof token !== "string" || token.length < 100 || token.length > 24000 ||
      !/^[A-Za-z0-9_-]+$/.test(token))
    throw new Error("Посилання для передачі формації пошкоджене.");
  let raw: any;
  try {
    const bytes = atob(token.replace(/-/g, "+").replace(/_/g, "/"));
    // Handoff format is intentionally numeric/ASCII-only; no private notes.
    if ([...bytes].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) > 126))
      throw new Error("Non-ASCII payload");
    raw = JSON.parse(bytes);
  } catch {
    throw new Error("Не вдалося прочитати передану формацію.");
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw) ||
      raw.version !== 1 || raw.source !== "h00k.top" ||
      !Number.isSafeInteger(raw.issuedAt) || !Number.isSafeInteger(raw.expiresAt) ||
      raw.issuedAt <= 0 || raw.expiresAt - raw.issuedAt !== 600_000 ||
      now > raw.expiresAt || raw.issuedAt > now + 60_000 ||
      !Number.isSafeInteger(raw.capturedAt) || raw.capturedAt <= 0 ||
      raw.capturedAt > raw.issuedAt + 60_000 ||
      typeof raw.symbol !== "string" || !/^[A-Z0-9]{2,30}$/.test(raw.symbol) ||
      !["binance","bybit"].includes(raw.exchange) ||
      !["spot","futures"].includes(raw.marketType) ||
      !["1m","5m","15m","1h","4h","1d"].includes(raw.timeframe) ||
      !Array.isArray(raw.candles) || raw.candles.length < 10 || raw.candles.length > 55 ||
      !Array.isArray(raw.markers) || raw.markers.length < 3 || raw.markers.length > 4)
    throw new Error("Переданий графік некоректний або термін дії посилання минув.");

  const step = TF_SECONDS[raw.timeframe as keyof typeof TF_SECONDS];
  const seen = new Set<string>();
  const markers = raw.markers.map((marker: any, i: number) => {
    if (!marker || typeof marker !== "object" ||
        !["entry","stop_loss","target","neckline"].includes(marker.type) ||
        seen.has(marker.type) ||
        typeof marker.price !== "number" || !Number.isFinite(marker.price) ||
        marker.price < 0.000000000001)
      throw new Error("Некоректні авторські рівні графіка.");
    seen.add(marker.type);
    const label = marker.type === "entry" ? "Entry" :
      marker.type === "stop_loss" ? "SL" : marker.type === "target" ? "TP" : "Neckline";
    const color = marker.type === "entry" ? "#38bdf8" :
      marker.type === "stop_loss" ? "#ef4444" : marker.type === "target" ? "#10b981" : "#f59e0b";
    return { id: "handoff-" + marker.type + "-" + i, type: marker.type, label, price: marker.price, color };
  });
  if (!["entry","stop_loss","target"].every(kind => seen.has(kind)))
    throw new Error("У формації мають бути Entry, Stop Loss і Take Profit.");

  let previous = 0;
  const candles = raw.candles.map((row: unknown) => {
    if (!Array.isArray(row) || row.length !== 6 ||
        !row.every((n: unknown) => typeof n === "number" && Number.isFinite(n)) ||
        !Number.isSafeInteger(row[0]) || row[0] % step !== 0 || row[0] <= previous ||
        (row[0] + step) * 1000 > raw.capturedAt ||
        row[1] <= 0 || row[2] < Math.max(row[1],row[4],row[3]) ||
        row[3] <= 0 || row[3] > Math.min(row[1],row[4]) || row[5] < 0)
      throw new Error("Переданий знімок містить некоректні або незакриті свічки.");
    previous = row[0];
    return { time: row[0], open: row[1], high: row[2], low: row[3], close: row[4], volume: row[5] };
  });

  const qualityProof = raw.qualityProof === undefined
    ? undefined : normalizeArchiveScoreProof(raw.qualityProof);
  // A pasted or modified signature does NOT become 'verified' in the browser:
  // Community's saveChart verifies the signature with its public key.
  return captureChartDocument({
    symbol: raw.symbol, exchange: raw.exchange, marketType: raw.marketType,
    timeframe: raw.timeframe, capturedAt: raw.capturedAt,
    candles, markers, drawings: [],
    ...(qualityProof ? { qualityProof } : {}),
  });
}
