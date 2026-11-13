import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../utils/apiFetch";
import {
  getProfileAddressState,
  type ProfileAddressInfo,
} from "./profileAddressState";
import "./profile-address.css";

type AddressNotice = { kind: "error" | "success" | "info"; text: string };

export function PublicProfileSettings() {
  const { user, profile, updateProfileData } = useAuth();
  const [info, setInfo] = useState<ProfileAddressInfo | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<AddressNotice | null>(null);

  useEffect(() => {
    let active = true;
    setInfo(null);
    setNotice(null);
    void apiJson("/api/account/username")
      .then((data: ProfileAddressInfo) => {
        if (!active) return;
        setInfo(data);
        setName(data.username ?? "");
      })
      .catch((error) => {
        if (active) {
          setNotice({
            kind: "error",
            text: error instanceof Error ? error.message : "Не вдалося завантажити персональну адресу.",
          });
        }
      });
    return () => { active = false; };
  }, [user?.uid]);

  const verified = info?.emailVerified === true;
  const enabled = profile?.community?.publicProfileEnabled === true;
  const address = getProfileAddressState(
    name, password, info, verified, busy, recovery, code,
  );

  async function refreshAddress() {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const data: ProfileAddressInfo = await apiJson("/api/account/username");
      setInfo(data);
      setName(data.username ?? name);
      setNotice({
        kind: "info",
        text: data.emailVerified
          ? "Підтвердження email перевірено. Можете зберегти адресу."
          : "Email поки не підтверджений. Перевірте пошту та розділ «Безпека акаунта».",
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Не вдалося оновити перевірку email.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function saveAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (address.disabledReason || busy) {
      if (address.disabledReason) setNotice({ kind: "info", text: address.disabledReason });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const data: ProfileAddressInfo = await apiJson("/api/account/username", {
        method: "POST",
        body: JSON.stringify({
          username: address.normalizedName,
          password,
          ...(recovery ? { recoveryCode: code } : { code }),
        }),
      });
      setInfo(data);
      setName(data.username ?? address.normalizedName);
      setNotice({
        kind: "success",
        text: "Персональну адресу збережено. Видимість публічного профілю керується окремо.",
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Не вдалося зберегти адресу.",
      });
    } finally {
      setPassword("");
      setCode("");
      setBusy(false);
    }
  }

  async function changeVisibility(next: boolean) {
    if (busy || !info?.username) return;
    setBusy(true);
    setNotice(null);
    try {
      await updateProfileData({ community: { publicProfileEnabled: next } });
      setNotice({
        kind: "success",
        text: next ? "Публічний профіль увімкнено." : "Публічний профіль приховано.",
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Не вдалося змінити видимість.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="community-card community-form community-profile-address" aria-label="Публічна адреса профілю">
      <div className="community-profile-address-header">
        <span className="community-page-kicker">ОСОБИСТА СТОРІНКА</span>
        <h3>Персональна адреса h00k</h3>
        <p>Зарезервуйте унікальне ім’я для посилання на свій профіль.</p>
      </div>

      {info?.url && (
        <a className="community-profile-address-link" href={info.url} target="_blank" rel="noopener noreferrer">
          {info.url} ↗
        </a>
      )}

      <div className="community-profile-address-status" aria-live="polite">
        <span className={verified ? "community-address-ok" : "community-address-warning"}>
          {info === null ? "Перевіряємо email…" : verified ? "Email підтверджено" : "Email потребує підтвердження"}
        </span>
        <button type="button" disabled={busy} onClick={() => void refreshAddress()}>
          Оновити перевірку
        </button>
      </div>

      {!verified && (
        <p className="community-profile-address-help">
          Щоб зберегти адресу, підтвердіть email у розділі «Безпека акаунта».
          Після підтвердження натисніть «Оновити перевірку».
        </p>
      )}

      <form className="community-form community-profile-address-form" onSubmit={(e) => void saveAddress(e)}>
        <label>
          Ім’я в адресі
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setNotice(null); }}
            minLength={3}
            maxLength={30}
            placeholder="Наприклад, trader-ivan"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
          />
        </label>
        {name.trim() && (
          <p className="community-hint community-address-preview">
            Ім’я для адреси: <strong>{address.normalizedName}</strong>
          </p>
        )}
        <p className="community-hint">
          3–30 латинських символів: починається з літери, закінчується літерою
          або цифрою. Деякі службові імена зарезервовані.
        </p>

        <label>
          Поточний пароль
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <label>
          {recovery ? "Резервний код 2FA" : "Код 2FA (якщо налаштовано)"}
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete={recovery ? "off" : "one-time-code"}
            inputMode={recovery ? "text" : "numeric"}
            placeholder={recovery ? "Одноразовий код відновлення" : "6-значний код"}
          />
        </label>
        <label className="community-profile-address-recovery">
          <input
            type="checkbox"
            checked={recovery}
            onChange={(e) => setRecovery(e.target.checked)}
          />
          Використати одноразовий резервний код
        </label>

        {address.lockedUntil !== null && (
          <p className="community-profile-address-help">
            Наступна зміна імені доступна після{" "}
            {new Date(address.lockedUntil).toLocaleString("uk-UA")}.
          </p>
        )}

        {address.disabledReason && (
          <p className="community-profile-address-reason" role="status">{address.disabledReason}</p>
        )}
        <button type="submit" className="community-primary" disabled={!!address.disabledReason}>
          {busy ? "Зберігаємо…" : "Зберегти адресу"}
        </button>
      </form>

      <div className="community-profile-address-visibility">
        <label className="community-profile-address-toggle">
          <input
            type="checkbox"
            checked={enabled}
            disabled={busy || !info?.username}
            onChange={(e) => void changeVisibility(e.target.checked)}
          />
          Дозволити перегляд публічного профілю без входу
        </label>
        {!info?.username && (
          <p className="community-hint">Спочатку зарезервуйте адресу, щоб увімкнути публічний профіль.</p>
        )}
        <p className="community-hint">
          За замовчуванням вимкнено. Публічна видимість може відкрити пости,
          фотографії та графіки для всього Інтернету. Дані з аудиторією «Друзі»
          або «Лише я» не розкриваються. Статистика й суми мають окремі дозволи.
        </p>
      </div>

      {notice && (
        <p
          className={"community-profile-address-notice community-address-notice-" + notice.kind}
          role={notice.kind === "error" ? "alert" : "status"}
        >
          {notice.text}
        </p>
      )}
    </section>
  );
}
