import React from "react";
import { Crosshair, ShieldCheck } from "lucide-react";
import type { ChartDocument } from "./chartDocument";
import { formatPublicSnapshotPrice, publicSnapshotLevels } from "./publicProfileLevelsModel";

/** Author-provided levels on a public chart, with no live data or inferred signal scores. */
export function PublicProfileChartLevels({ document }: { document: ChartDocument }) {
  const { levels, extra } = publicSnapshotLevels(document);
  if (!levels.length) return null;
  return <div className="public-profile-chart-levels">
    <div className="public-profile-chart-levels-heading">
      <Crosshair size={14} aria-hidden="true" />
      <strong>Рівні на збереженому графіку</strong>
      <span>Авторська розмітка</span>
    </div>
    <ul className="public-profile-chart-levels-list" aria-label="Авторські рівні Entry, Stop Loss, Take Profit">
      {levels.map((level, i) => <li key={level.kind + ":" + i}
        className={"public-profile-chart-level public-profile-chart-level-" + level.kind}>
        <span>{level.label}</span>
        <strong>{formatPublicSnapshotPrice(level.price)}</strong>
      </li>)}
    </ul>
    {extra > 0 && <p className="public-profile-chart-levels-extra">
      Ще {extra} {extra === 1 ? "рівень" : "рівнів"} — у повному HookChart
    </p>}
    <p className="public-profile-chart-levels-note">
      <ShieldCheck size={13} aria-hidden="true" />
      Рівні задані автором знімка, не є перевіреним торговим сигналом.
    </p>
  </div>;
}
