import { normalizeArchiveScoreProof, type ArchiveScorePayload, type SignedArchiveScoreProof } from "./archiveScoreProof";
import type { ChartDocument } from "./chartDocument";

/** Kept in a pure shared module so client preflight and server checks cannot drift. */
export function archivedPriceMatches(actual: number, expected: number): boolean {
  return Number.isFinite(actual) && Number.isFinite(expected) &&
    actual > 0 && expected > 0 &&
    Math.abs(actual - expected) <= Math.max(1e-12, Math.abs(expected) * 1e-8);
}

export function archiveScoreBindingIssues(
  payload: ArchiveScorePayload,
  document: Pick<ChartDocument, "symbol" | "exchange" | "marketType" | "timeframe" | "markers">,
): string[] {
  const issues: string[] = [];
  if (document.symbol !== payload.symbol) issues.push("монета");
  if (document.exchange !== payload.exchange) issues.push("біржа");
  if (document.marketType !== payload.marketType) issues.push("тип ринку");
  if (document.timeframe !== payload.timeframe) issues.push("таймфрейм");
  const levels: Array<[string, number, string]> = [
    ["entry", payload.entry, "Entry"],
    ["stop_loss", payload.stop, "Stop Loss"],
    ["target", payload.target, "Take Profit"],
  ];
  for (const [kind, price, label] of levels) {
    if (!document.markers.some(m => m.type === kind && archivedPriceMatches(m.price, price)))
      issues.push(label);
  }
  return issues;
}

export type ArchiveProofDraftAssessment =
  | { status: "none"; message: ""; proof?: never }
  | { status: "invalid" | "expired" | "mismatch"; message: string; proof?: never }
  | { status: "ready"; message: string; proof: SignedArchiveScoreProof };

/**
 * Browser-side feedback only: a "ready" result is NOT a cryptographic check.
 * The server independently verifies Ed25519 on each saved chart.
 */
export function assessArchiveProofDraft(
  text: string,
  document: ChartDocument,
  now = Date.now(),
): ArchiveProofDraftAssessment {
  const input = text.trim();
  if (!input) return { status: "none", message: "" };
  if (input.length > 3000) return { status: "invalid", message: "Доказ оцінки завеликий." };

  let proof: SignedArchiveScoreProof;
  try {
    proof = normalizeArchiveScoreProof(JSON.parse(input));
  } catch {
    return { status: "invalid", message: "Вставте повний JSON підписаної оцінки з h00k.top." };
  }

  const { payload } = proof;
  if (payload.issuedAt > now + 60_000 || payload.assessedAt > now + 60_000 ||
      now > payload.expiresAt)
    return { status: "expired", message: "Строк дії архівної оцінки минув або час у записі некоректний. Експортуйте новий доказ із h00k.top." };

  const issues = archiveScoreBindingIssues(payload, document);
  if (issues.length)
    return { status: "mismatch", message: "Підписана архівна оцінка не відповідає графіку: " +
      issues.join(", ") + ". Поверніть початкові рівні або вилучіть оцінку." };

  return { status: "ready", proof, message:
    "Рівні та параметри збігаються з архівним записом. Цифровий підпис перевірить сервер перед збереженням; це не підтвердження торгового сигналу." };
}
