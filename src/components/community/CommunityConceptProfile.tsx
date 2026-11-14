import React, { useEffect, useMemo, useState } from "react";
import { Award, Check, Gift, Globe2, MessageCircle, Pencil, Settings, Star, UsersRound, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../utils/apiFetch";
import { TRADING_SESSIONS, formatZonedTime, getSessionWindow, resolveTimeZone } from "../../utils/tradingSessions";
import { ownerAvatarUrl } from "./profileMediaAvatar";

/** Live-account replacement for the example TradingAtlas sidebar in social. */
export function CommunityConceptProfile({
  onProfile, onFriends, onSettings, onFriendProfile, onFriendChat, version = 0,
}: {
  onProfile: () => void;
  onFriends: () => void;
  onSettings: () => void;
  onFriendProfile: (id: string) => void;
  onFriendChat: (id: string, name: string) => void;
  version?: number;
}) {
  const { user, profile, updateProfileData } = useAuth();
  const [info, setInfo] = useState<{ points?: number; bio?: string; status?: { text?: string } } | null>(null);
  const [awards, setAwards] = useState<{ balance: number; received: number; gifted: number } | null>(null);
  const [friends, setFriends] = useState<number | null>(null);
  const [friendRows, setFriendRows] = useState<Array<{
    id: string; displayName: string; username?: string | null;
    avatarUrl?: string | null; accepted: boolean;
  }>>([]);
  const [friendVersion, updateFriendVersion] = useState(0);
  useEffect(() => {
    const refresh = () => updateFriendVersion(value => value + 1);
    window.addEventListener("community:friends-changed", refresh);
    return () => window.removeEventListener("community:friends-changed", refresh);
  }, []);
  const [editing, setEditing] = useState<"status" | "bio" | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");
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
      const accepted = f.status === "fulfilled" && Array.isArray(f.value.people)
        ? f.value.people.filter((friend: { accepted?: boolean }) => friend.accepted === true)
        : [];
      setFriends(f.status === "fulfilled" ? accepted.length : null);
      setFriendRows(accepted);
    });
    return () => { live = false; };
  }, [user?.uid, version, friendVersion]);

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
  // The account profile is the source of truth immediately after PATCH.
  // A separate sidebar GET may be stale or may not contain recent edits.
  const bio = profile?.community?.bio ?? info?.bio ?? "";
  const currentStatus = profile?.community?.status;
  const status = currentStatus?.expiresAt && Date.parse(currentStatus.expiresAt) <= Date.now()
    ? "" : (currentStatus?.text ?? info?.status?.text ?? "");

  function beginEdit(kind: "bio" | "status") {
    if (saving) return;
    setDraft(kind === "bio" ? bio : status);
    setEditing(kind);
    setEditError("");
    setEditSuccess("");
  }
  function cancelEdit() {
    if (saving) return;
    setEditing(null);
    setEditError("");
  }
  async function saveInline(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || saving || !user) return;
    const kind = editing;
    const value = draft.trim();
    if (value.length > (kind === "bio" ? 2000 : 280)) {
      setEditError("Текст перевищує дозволену довжину");
      return;
    }
    setSaving(true);
    setEditError("");
    setEditSuccess("");
    try {
      if (kind === "bio") {
        await updateProfileData({ community: { bio: value } });
      } else {
        // This is self-reported, never a live exchange / online status.
        // Preserve explicit audience preference; default to private.
        await updateProfileData({ community: {
          status: { text: value, audience: currentStatus?.audience ?? "private" },
        } });
      }
      setEditing(null);
      setEditSuccess(kind === "bio" ? "Опис профілю збережено" : "Статус збережено");
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Не вдалося зберегти");
    } finally {
      setSaving(false);
    }
  }
  useEffect(() => {
    // Never show previous account's drafts or success notices after logout.
    setEditing(null);
    setDraft("");
    setEditError("");
    setEditSuccess("");
  }, [user?.uid]);
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
          <button type="button" className="community-concept-text-button"
            onClick={() => beginEdit("status")} disabled={saving} aria-label="Змінити свій статус">
            <Pencil size={12} aria-hidden="true" /> {status ? "Змінити статус" : "Додати статус"}
          </button>
        </div>
        <button type="button" className="community-concept-settings" onClick={onSettings} aria-label="Налаштування профілю"><Settings size={18} /></button>
      </div>
      {editing === "status" && <form className="community-concept-inline-editor"
        aria-label="Редагування свого статусу" onSubmit={e => void saveInline(e)}>
        <label htmlFor="community-quick-status">Мій статус (до 280 символів)</label>
        <input id="community-quick-status" list="community-status-presets" maxLength={280}
          value={draft} disabled={saving} onChange={e => setDraft(e.target.value)}
          placeholder="Аналізую ринок" autoFocus />
        <datalist id="community-status-presets">
          {["Аналізую ринок", "Шукаю формації", "Стежу за ліквідністю", "Поза ринком / відпочиваю"].map(option => (
            <option key={option} value={option} />
          ))}
        </datalist>
        <small>Ваш особистий опис, не підтвердження присутності онлайн чи відкритої угоди.
          Аудиторія залишається як у налаштуваннях профілю.</small>
        <div className="community-concept-inline-actions">
          <button type="button" disabled={saving} onClick={cancelEdit}><X size={14} aria-hidden="true" /> Скасувати</button>
          <button type="submit" disabled={saving}><Check size={14} aria-hidden="true" /> {saving ? "Зберігаємо…" : "Зберегти"}</button>
        </div>
      </form>}
      <div className="community-concept-sidebar-section">
        <h3><Globe2 size={16} /> Торгові сесії (обрані)</h3>
        {sessions.length ? sessions.map(s => <div className="community-concept-session-tag" key={s.id}><span>{s.flag} {s.city}</span><time>{s.time}</time></div>) : (
          <p className="community-concept-muted">Сесії ще не вибрано. Виберіть їх у правій колонці.</p>
        )}
        <small className="community-concept-muted"><Globe2 size={12} /> {zone}</small>
      </div>
      <div className="community-concept-sidebar-section">
        <h3>Про мене</h3>
        {editing === "bio" ? (
          <form className="community-concept-inline-editor" aria-label="Редагування опису профілю"
            onSubmit={e => void saveInline(e)}>
            <label htmlFor="community-quick-bio">Коротко про себе</label>
            <textarea id="community-quick-bio" maxLength={2000} rows={4} value={draft}
              onChange={e => setDraft(e.target.value)} disabled={saving}
              autoFocus placeholder="Розкажіть про свій підхід до трейдингу" />
            <small>{draft.length}/2000 · Видимість опису налаштовується окремо в профілі.</small>
            <div className="community-concept-inline-actions">
              <button type="button" disabled={saving} onClick={cancelEdit}><X size={14} aria-hidden="true" /> Скасувати</button>
              <button type="submit" disabled={saving}><Check size={14} aria-hidden="true" /> {saving ? "Зберігаємо…" : "Зберегти"}</button>
            </div>
          </form>
        ) : <>
          <p className="community-concept-bio">{bio || "Додайте опис свого торгового стилю у профілі."}</p>
          <button type="button" className="community-concept-text-button" onClick={() => beginEdit("bio")}>
            <Pencil size={12} aria-hidden="true" /> Редагувати опис
          </button>
          <button type="button" className="community-concept-text-button" onClick={onProfile}>Усі налаштування профілю</button>
        </>}
        {editError && <p className="community-concept-edit-error" role="alert">{editError}</p>}
        {editSuccess && <p className="community-concept-edit-success" role="status">{editSuccess}</p>}
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
      <div className="community-concept-sidebar-section community-concept-friend-shortcuts">
        <h3><UsersRound size={16} /> Мої друзі {friends !== null ? "(" + friends + ")" : ""}</h3>
        {friendRows.length > 0 ? (
          <div className="community-concept-friends-list">
            {friendRows.slice(0, 6).map(person => (
              <div className="community-concept-friend-row" key={person.id}>
                <span className="community-concept-friend-avatar" aria-hidden="true">
                  {(person.displayName ?? "Т").trim().slice(0, 1).toUpperCase()}
                  {person.avatarUrl && <img src={person.avatarUrl} alt="" loading="lazy"
                    onError={event => { event.currentTarget.hidden = true; }} />}
                </span>
                <button type="button" className="community-concept-friend-name"
                  onClick={() => onFriendProfile(person.id)}>
                  <strong>{person.displayName || "Трейдер"}</strong>
                  {person.username && <small>@{person.username}</small>}
                </button>
                <button type="button" className="community-concept-friend-message"
                  aria-label={"Написати " + (person.displayName || "трейдеру")}
                  title="Написати" onClick={() => onFriendChat(person.id, person.displayName || "Трейдер")}>
                  <MessageCircle size={16} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="community-concept-muted">Після підтвердження дружби тут з’являться ваші контакти — без вигаданих статусів онлайн.</p>
        )}
        <button type="button" className="community-concept-text-button" onClick={onFriends}>
          Усі друзі та запити
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
