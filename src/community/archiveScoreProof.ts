/**
 * A h00k.top archive-record proof: the source server signed an archived value,
 * NOT an independent audit of its scanner algorithm, exchange data or trades.
 * The signature itself is checked only by the Community backend.
 */
export type ArchiveScorePayload = {
  version: 1;
  issuer: "h00k.top";
  purpose: "archive-score-record";
  archiveId: string;
  symbol: string;
  exchange: "binance" | "bybit";
  marketType: "spot" | "futures";
  timeframe: "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
  score: number;
  entry: number;
  stop: number;
  target: number;
  assessedAt: number;
  issuedAt: number;
  expiresAt: number;
};

export type SignedArchiveScoreProof = {
  payload: ArchiveScorePayload;
  signature: string;
};

const payloadKeys = [
  "version", "issuer", "purpose", "archiveId", "symbol", "exchange",
  "marketType", "timeframe", "score", "entry", "stop", "target",
  "assessedAt", "issuedAt", "expiresAt",
];
const price = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0;
const time = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v > 0;

/** Structural checks only. A valid structure alone must NEVER be called verified. */
export function normalizeArchiveScoreProof(raw: unknown): SignedArchiveScoreProof {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Некоректний доказ оцінки");
  const proof = raw as Record<string, any>;
  const p = proof.payload;
  if (Object.keys(proof).length !== 2 || !Object.hasOwn(proof, "payload") ||
      !Object.hasOwn(proof, "signature") ||
      typeof proof.signature !== "string" || !/^[A-Za-z0-9_-]{86}$/.test(proof.signature) ||
      !p || typeof p !== "object" || Array.isArray(p) ||
      Object.keys(p).length !== payloadKeys.length ||
      payloadKeys.some(k => !Object.hasOwn(p,k)) ||
      p.version !== 1 || p.issuer !== "h00k.top" || p.purpose !== "archive-score-record" ||
      typeof p.archiveId !== "string" || !/^[a-zA-Z0-9_-]{1,140}$/.test(p.archiveId) ||
      typeof p.symbol !== "string" || !/^[A-Z0-9]{2,30}$/.test(p.symbol) ||
      !["binance","bybit"].includes(p.exchange) ||
      !["spot","futures"].includes(p.marketType) ||
      !["1m","5m","15m","1h","4h","1d"].includes(p.timeframe) ||
      typeof p.score !== "number" || !Number.isFinite(p.score) || p.score < 0 || p.score > 100 ||
      !price(p.entry) || !price(p.stop) || !price(p.target) ||
      !time(p.assessedAt) || !time(p.issuedAt) || !time(p.expiresAt) ||
      p.assessedAt > p.issuedAt + 60_000 || p.expiresAt <= p.issuedAt ||
      p.expiresAt - p.issuedAt !== 10 * 60_000) {
    throw new Error("Некоректний доказ оцінки");
  }
  // Preserve the signed property order: the server signs JSON.stringify(payload).
  return { payload: p as ArchiveScorePayload, signature: proof.signature };
}

export function archiveScoreSigningMessage(payload: ArchiveScorePayload): string {
  return "h00k-score-archive:v1\n" + JSON.stringify(payload);
}
