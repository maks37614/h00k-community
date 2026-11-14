import { createPublicKey, verify } from "node:crypto";
import type { ChartDocument } from "../../src/community/chartDocument";
import {
  archiveScoreSigningMessage, normalizeArchiveScoreProof,
  type SignedArchiveScoreProof,
} from "../../src/community/archiveScoreProof";
import { fail } from "./security";

const closePrice = (a: number, b: number) =>
  Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0 &&
  Math.abs(a - b) <= Math.max(1e-12, Math.abs(a) * 1e-8);

const hasMarker = (doc: ChartDocument, type: "entry" | "stop_loss" | "target", price: number) =>
  doc.markers.some(marker => marker.type === type && closePrice(marker.price, price));

/**
 * Fail-closed server signature verification before storing any public chart.
 * Signature proves h00k signed this saved-archive *record*, NOT that the
 * archival score, trade execution or algorithm inputs were independently audited.
 */
export function verifyArchiveScoreProof(
  raw: unknown, document: ChartDocument, encodedPublicKey: string | undefined,
  now = Date.now(),
): SignedArchiveScoreProof {
  let proof: SignedArchiveScoreProof;
  try { proof = normalizeArchiveScoreProof(raw); }
  catch { fail("Неправильний формат підтвердження архівної оцінки", 422); }

  if (!encodedPublicKey) fail("Перевірка підписаних оцінок поки не налаштована", 503);
  let key;
  try {
    key = createPublicKey(Buffer.from(encodedPublicKey, "base64"));
    if (key.asymmetricKeyType !== "ed25519") throw new Error("Invalid key type");
  } catch { fail("Перевірка підписаних оцінок тимчасово недоступна", 503); }

  const signature = Buffer.from(proof.signature, "base64url");
  if (signature.length !== 64 || !verify(null,
    Buffer.from(archiveScoreSigningMessage(proof.payload), "utf8"), key, signature,
  )) fail("Підпис архівної оцінки недійсний", 422);

  const p = proof.payload;
  if (!Number.isSafeInteger(now) || p.issuedAt > now + 60_000 ||
      now > p.expiresAt || p.assessedAt > now + 60_000)
    fail("Термін дії підтвердження минув", 422);
  if (document.symbol !== p.symbol || document.exchange !== p.exchange ||
      document.marketType !== p.marketType || document.timeframe !== p.timeframe ||
      !hasMarker(document, "entry", p.entry) ||
      !hasMarker(document, "stop_loss", p.stop) ||
      !hasMarker(document, "target", p.target))
    fail("Оцінка не відповідає ринку, таймфрейму або збереженим рівням графіка", 422);
  return proof;
}
