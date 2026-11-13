import React, { useEffect, useState } from "react";
import { Clock3, Globe2, ShieldCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  TRADING_SESSIONS,
  formatSessionCountdown,
  formatTimeZoneOffset,
  formatZonedTime,
  getSessionWindow,
  resolveTimeZone,
  sessionDateLabel,
} from "../../utils/tradingSessions";
import "./social-trading-sessions.css";

/**
 * Real regional activity windows. The IANA calculations already power h00k
 * and account for independent US/EU/Australian DST changes.
 * No live exchange queries, no market data and no simulated trading activity.
 */
export function CommunityTradingSessions({
  variant = "page",
}: {
  variant?: "page" | "sidebar";
}) {
  const { profile, updateProfileData } = useAuth();
  const [now, setNow] = useState(() => new Date());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const update = () => setNow(new Date());
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") update();
    }, 60_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  const zone = resolveTimeZone(profile?.timeZone);
  const preference = profile?.community?.tradingSessionIds;
  const selected: string[] = Array.isArray(preference)
    ? preference.filter((id: unknown): id is string =>
        typeof id === "string" && TRADING_SESSIONS.some((session) => session.id === id),
      )
    : [];
  const activeCount = TRADING_SESSIONS.filter(
    (session) => selected.includes(session.id) && getSessionWindow(session, now).active,
  ).length;

  async function toggle(id: string) {
    if (busyId || !profile) return;
    const next = selected.includes(id)
      ? selected.filter((item) => item !== id)
      : [...selected, id];
    setBusyId(id);
    setError("");
    try {
      await updateProfileData({ community: { tradingSessionIds: next } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не вдалося зберегти торгові сесії");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section
      className={"community-sessions-card community-sessions-" + variant}
      aria-label="Мої торгові сесії"
    >
      <header className="community-sessions-header">
        <div>
          <span className="community-page-kicker">РЕГІОНАЛЬНА АКТИВНІСТЬ</span>
          <h2><Clock3 size={19} aria-hidden="true" /> Мої торгові сесії</h2>
        </div>
        {selected.length > 0 && (
          <span className="community-sessions-count">
            {activeCount} / {selected.length} активних
          </span>
        )}
      </header>
      <p className="community-sessions-lead">
        Оберіть регіональні сесії, за якими стежите. Це орієнтовні робочі вікна
        у будні, <b>не години роботи криптобірж</b> і не підтвердження обсягу торгів.
      </p>
      <div className="community-sessions-zone">
        <Globe2 size={15} aria-hidden="true" />
        <span>{zone} · {formatTimeZoneOffset(now, zone)}</span>
        <small>{formatZonedTime(now, zone)}</small>
      </div>
      {error && <p className="community-sessions-error" role="alert">{error}</p>}
      <div className="community-sessions-list">
        {TRADING_SESSIONS.map((session) => {
          const window = getSessionWindow(session, now);
          const checked = selected.includes(session.id);
          const start = formatZonedTime(window.startsAt, zone);
          const end = formatZonedTime(window.endsAt, zone);
          return (
            <label
              className={
                "community-session-row" +
                (checked ? " community-session-selected" : "") +
                (checked && window.active ? " community-session-live" : "")
              }
              key={session.id}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={!profile || !!busyId}
                onChange={() => void toggle(session.id)}
                aria-label={"Стежити за сесією " + session.city}
              />
              <span className="community-session-flag" aria-hidden="true">{session.flag}</span>
              <span className="community-session-detail">
                <strong>{session.city}</strong>
                <small>{start}–{end} · {sessionDateLabel(window.startsAt, window.endsAt, zone)}</small>
                {checked && window.active && (
                  <span
                    className="community-session-progress"
                    aria-hidden="true"
                  >
                    <span style={{ width: Math.max(0, Math.min(100, window.progress * 100)) + "%" }} />
                  </span>
                )}
              </span>
              <span className="community-session-state">
                <b className={window.active ? "community-session-state-active" : ""}>
                  {window.active ? "Триває" : "Очікується"}
                </b>
                <small>
                  {window.active ? "до завершення" : "до початку"}{" "}
                  {formatSessionCountdown(window.nextChangeAt.getTime() - now.getTime())}
                </small>
              </span>
            </label>
          );
        })}
      </div>
      {!profile && <p className="community-sessions-lead">Завантажуємо налаштування профілю…</p>}
      {selected.length === 0 && profile && (
        <p className="community-sessions-empty">Жодної сесії не обрано. Позначте потрібні для особистого списку.</p>
      )}
      <footer className="community-sessions-foot">
        <ShieldCheck size={16} aria-hidden="true" />
        <span>Вибір зберігається у вашому акаунті. Час рахується з IANA-зонами та DST, без запитів до бірж.</span>
      </footer>
    </section>
  );
}
