import React from "react";
import { CalendarRange, ShieldCheck } from "lucide-react";
import { publicDailyTimeline, type PublicDailyHistoryPayload } from "./publicProfileDailyHistoryModel";

/** Zero exchange connections: this chart uses only public aggregated daily counts. */
export function PublicProfileDailyHistory({ data }: { data: PublicDailyHistoryPayload }) {
  const days = publicDailyTimeline(data);
  if (!days.length) return <p role="status">Історія за днями наразі недоступна.</p>;
  const max = Math.max(1, ...days.map(day => day.count));
  const total = days.reduce((sum, day) => sum + day.count, 0);
  const wins = days.reduce((sum, day) => sum + day.wins, 0);
  const losses = days.reduce((sum, day) => sum + day.losses, 0);
  const flat = days.reduce((sum, day) => sum + day.flat, 0);

  return <section className="public-profile-panel public-daily-history" aria-labelledby="public-daily-history-heading">
    <div className="public-daily-history-heading">
      <div>
        <span className="public-profile-kicker">ІСТОРІЯ ІМПОРТОВАНИХ ЗАКРИТТІВ</span>
        <h3 id="public-daily-history-heading"><CalendarRange size={18} aria-hidden="true" /> Динаміка за 30 днів</h3>
      </div>
      <span className="public-daily-history-tz">UTC</span>
    </div>
    <p className="public-profile-muted">Кількість закритих ордерів за календарними днями UTC. Дні без імпортованих закриттів показані порожніми.</p>
    {total === 0 ? <p className="public-daily-history-empty">За цей період імпортованих закриттів немає.</p> : <>
      <div className="public-daily-history-summary" aria-label="Підсумки за 30 днів">
        <span><b>{total}</b> закриттів</span>
        <span><b>{wins}</b> прибуткових</span>
        <span><b>{losses}</b> збиткових</span>
        <span><b>{flat}</b> беззбиткових</span>
      </div>
      <div className="public-daily-history-scroll">
        <ol className="public-daily-history-bars" aria-label="Розподіл імпортованих закриттів за днями">
          {days.map((day, i) => {
            const height = day.count ? Math.max(4, day.count / max * 100) : 0;
            const description = `${day.day}: ${day.count} закриттів, прибуткових ${day.wins}, збиткових ${day.losses}, беззбиткових ${day.flat}`;
            return <li key={day.day} aria-label={description} title={description}>
              <div className="public-daily-history-bar-slot" aria-hidden="true">
                {day.count > 0 && <div className="public-daily-history-stack" style={{ height: height + "%" }}>
                  {day.wins > 0 && <span className="public-daily-history-positive" style={{ flexGrow: day.wins }} />}
                  {day.losses > 0 && <span className="public-daily-history-negative" style={{ flexGrow: day.losses }} />}
                  {day.flat > 0 && <span className="public-daily-history-neutral" style={{ flexGrow: day.flat }} />}
                </div>}
              </div>
              <time dateTime={day.day}>{i % 5 === 0 || i === 29 ? day.day.slice(8) : ""}</time>
            </li>;
          })}
        </ol>
      </div>
      <div className="public-daily-history-legend" aria-label="Позначення кольорів">
        <span><i className="public-daily-history-positive" /> Прибуткові</span>
        <span><i className="public-daily-history-negative" /> Збиткові</span>
        <span><i className="public-daily-history-neutral" /> Беззбиткові</span>
      </div>
    </>}
    <p className="public-daily-history-notice"><ShieldCheck size={14} aria-hidden="true" />
      Це не баланс, прибутковість рахунку або повна історія торгів. Дані завантажуються лише при відкритті «Результатів».
    </p>
  </section>;
}
