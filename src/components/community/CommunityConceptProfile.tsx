import React, { useEffect, useMemo, useState } from "react";
import { Award, Gift, Globe2, Settings, Star, UsersRound } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../utils/apiFetch";
import { TRADING_SESSIONS, formatZonedTime, getSessionWindow, resolveTimeZone } from "../../utils/tradingSessions";
import { ownerAvatarUrl } from "./profileMediaAvatar";

/** Live-account replacement for the example TradingAtlas sidebar in social. */
export function CommunityConceptProfile({
  onProfile, onFriends, onSettings, version = 0,
}: {
  onProfile: () => void;
  onFriends: () => void;
  onSettings: () => void;
  version?: number;
}) {
  const { user, profile } = useAuth();
  const [info, setInfo] = useState<{ points?: number; bio?: string; status?: { text?: string } } | null>(null);
  const [awards, setAwards] = useState<{ balance: number; received: number; gifted: number } | null>(null);
  const [friends, setFriends] = useState<number | null>(null);
  useEffect(() => {
    if (!user?.uid) return;
    let live = true;
    void Promise.allSettled([
      apiJson("/api/community/profiles/" + encodeURIComponent(user.uid)),
      apiJson("/api/community/awards"),
      apiJson("/api/community/friends"),
    ]).then(([p, a, f]) => {
      if (!live) return;
      setInfo(p.status === "fulfilled" ? p.value.profile : null);
      setAwards(a.status === "fulfilled" ? a.value : null);
      setFriends(f.status === "fulfilled" ? (f.value.people ?? []).filter((friend: { accepted?: boolean }) => friend.accepted).length : null);
    });
    return () => { live = false; };
  }, [user?.uid, version]);

  const zone = resolveTimeZone(profile?.timeZone);
  const sessions = useMemo(() => {
    const selected = profile?.community?.tradingSessionIds ?? [];
    const now = new Date();
    return TRADING_SESSIONS.filter(s => selected.includes(s.id)).map(s => {
      const window = getSessionWindow(s, now);
      return { id: s.id, flag: s.flag, city: s.city, time: formatZonedTime(window.startsAt, zone) + "–" + formatZonedTime(window.endsAt, zone) };
    });
  }, [profile?.community?.tradingSessionIds, zone]);
  const name = profile?.displayName ?? user?.displayName ?? "Трейдер";
  const photo = ownerAvatarUrl(profile?.community) ?? user?.photoURL;
  const bio = info?.bio || profile?.community?.bio || "";
  const status = info?.status?.text || profile?.community?.status?.text || "";
  return (
    <section className="community-concept-profile" aria-label="Профіль користувача">
      <div className="community-concept-identity">
        {photo ? <img className="community-concept-avatar" src={photo} alt="" /> : (
          <span className="community-concept-avatar community-concept-avatar-letter" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
        )}
        <div className="community-concept-identity-body">
          <button type="button" className="community-concept-name" onClick={onProfile}>{name}</button>
          <span className="community-concept-muted">h00k Community</span>
          {status && <span className="community-concept-status"><span aria-hidden="true">●</span> {status}</span>}
        </div>
        <button type="button" className="community-concept-settings" onClick={onSettings} aria-label="Налаштування профілю"><Settings size={18} /></button>
      </div>
      <div className="community-concept-sidebar-section">
        <h3><Globe2 size={16} /> Торгові сесії (обрані)</h3>
        {sessions.length ? sessions.map(s => <div className="community-concept-session-tag" key={s.id}><span>{s.flag} {s.city}</span><time>{s.time}</time></div>) : (
          <p className="community-concept-muted">Сесії ще не вибрано. Виберіть їх у правій колонці.</p>
        )}
        <small className="community-concept-muted"><Globe2 size={12} /> {zone}</small>
      </div>
      <div className="community-concept-sidebar-section">
        <h3>Про мене</h3>
        <p className="community-concept-bio">{bio || "Додайте опис свого торгового стилю у профілі."}</p>
        <button type="button" className="community-concept-text-button" onClick={onProfile}>Редагувати профіль</button>
      </div>
      <div className="community-concept-sidebar-section community-concept-metrics">
        <h3>Статистика Community</h3>
        <div className="community-concept-points"><Star size={19} /> Баланс балів: <strong>{awards ? awards.balance : "—"}</strong></div>
        <div className="community-concept-stat"><Award size={16} /> Отримано нагород: <strong>{awards ? awards.received : "—"}</strong></div>
        <div className="community-concept-stat"><Gift size={16} /> Подаровано нагород: <strong>{awards ? awards.gifted : "—"}</strong></div>
        <button type="button" className="community-concept-stat community-concept-friends" onClick={onFriends}>
          <UsersRound size={16} /> Підтверджені друзі: <strong>{friends === null ? "—" : friends}</strong>
        </button>
      </div>
      <div className="community-concept-sidebar-section">
        <h3>Досягнення</h3>
        <p className="community-concept-muted">Нагороди й бали обчислюються за реальними подіями вашого акаунта.</p>
        <div className="community-concept-achievements">
          <span><Star size={24} /> Репутація</span>
          <span><UsersRound size={24} /> Спільнота</span>
          <span><Award size={24} /> Нагороди</span>
        </div>
      </div>
    </section>
  );
}
