import React from "react";
import { normalizeArchiveScoreProof, type ArchiveScorePayload } from "../../community/archiveScoreProof";
import type { ArchiveProofDraftAssessment } from "../../community/archiveScoreBinding";

type Props = {
  proofText: string;
  assessment: ArchiveProofDraftAssessment;
  onRemove: () => void;
};

const verifiedRubric = "regular-flow-72-13-15-v1";
const formatDate = (time: number) =>
  new Date(time).toLocaleString("uk-UA", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });

/**
 * Preview of source-declared metadata ONLY. The browser cannot authenticate an
 * Ed25519 signature: the Community server verifies it on explicit chart save.
 */
export function ArchiveScoreProvenance({ proofText, assessment, onRemove }: Props) {
  if (!proofText.trim()) return null;
  let payload: ArchiveScorePayload | null = null;
  try {
    if (proofText.length <= 3000)
      payload = normalizeArchiveScoreProof(JSON.parse(proofText)).payload;
  } catch {
    // A malformed or modified proof has no trusted metadata to present.
  }
  const blocked = assessment.status !== "ready";
  const status = assessment.status === "ready"
    ? "Параметри збігаються · підпис ще не перевірено"
    : assessment.status === "mismatch"
      ? "Рівні або ринок змінено"
      : assessment.status === "expired"
        ? "Строк дії закінчився"
        : "Неправильний запис";

  return (
    <section className={"community-chart-provenance community-chart-provenance-" + assessment.status}
      aria-label="Походження архівної оцінки" role={blocked ? "alert" : "status"}>
      <header className="community-chart-provenance-heading">
        <h3>Походження архівної оцінки</h3>
        <span className="community-chart-provenance-state">{status}</span>
      </header>
      {payload && <dl className="community-chart-provenance-fields">
        <div><dt>Оцінка із запису</dt><dd className="community-chart-provenance-score">
          {payload.score}/100
        </dd></div>
        <div><dt>Заявлене джерело</dt><dd>{payload.issuer} · власний архів формацій</dd></div>
        <div><dt>Версія рубрики</dt><dd>
          {payload.rubric === verifiedRubric ? "Стандартна 72/13/15 · v1" : payload.rubric}
        </dd></div>
        <div><dt>Час виявлення в архіві</dt><dd>
          <time dateTime={new Date(payload.assessedAt).toISOString()}>
            {formatDate(payload.assessedAt)}
          </time>
        </dd></div>
        <div><dt>Час підписання запису</dt><dd>
          <time dateTime={new Date(payload.issuedAt).toISOString()}>
            {formatDate(payload.issuedAt)}
          </time>
        </dd></div>
        <div><dt>Використати до</dt><dd>
          <time dateTime={new Date(payload.expiresAt).toISOString()}>
            {formatDate(payload.expiresAt)}
          </time>
        </dd></div>
        <div><dt>Ринок у записі</dt><dd>
          {payload.symbol} · {payload.exchange.toUpperCase()} · {payload.marketType} · {payload.timeframe}
        </dd></div>
      </dl>}
      <div className="community-chart-provenance-verification">
        <strong>Статус перевірки перед збереженням</strong>
        <p>{assessment.message}</p>
      </div>
      <p className="community-chart-provenance-disclaimer">
        Це попередній перегляд архівних даних, а не доказ справжності.
        Лише сервер перевіряє цифровий підпис Ed25519 під час збереження.
        Архівна оцінка не підтверджує точність сигналу або виконання угоди.
      </p>
      {blocked && <button type="button" className="community-chart-provenance-remove"
        onClick={onRemove}>Вилучити архівну оцінку й залишити графік</button>}
    </section>
  );
}
