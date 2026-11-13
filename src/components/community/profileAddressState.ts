/** Client-side preview only. The server validates reserved names and permissions. */
export interface ProfileAddressInfo {
  username?: string | null;
  url?: string | null;
  emailVerified?: boolean;
  changeAllowedAt?: string | null;
}

export interface ProfileAddressState {
  normalizedName: string;
  validFormat: boolean;
  unchanged: boolean;
  lockedUntil: number | null;
  disabledReason: string | null;
}

const PROFILE_NAME_PATTERN = /^[a-z][a-z0-9-]{1,28}[a-z0-9]$/;

export function getProfileAddressState(
  name: string,
  password: string,
  info: ProfileAddressInfo | null,
  verified: boolean,
  busy: boolean,
  recovery: boolean,
  secondFactor: string,
  now: number = Date.now(),
): ProfileAddressState {
  const normalizedName = name.trim().toLowerCase();
  const validFormat = PROFILE_NAME_PATTERN.test(normalizedName);
  const unchanged = !!info?.username && info.username === normalizedName;
  const nextAllowed = info?.changeAllowedAt ? Date.parse(info.changeAllowedAt) : NaN;
  const lockedUntil =
    !!info?.username && !unchanged && Number.isFinite(nextAllowed) && nextAllowed > now
      ? nextAllowed
      : null;

  let disabledReason: string | null = null;
  if (busy) disabledReason = "Завершуємо попередню дію.";
  else if (!info) disabledReason = "Перевіряємо стан вашої персональної адреси.";
  else if (!verified) disabledReason = "Підтвердіть email у розділі «Безпека акаунта» і оновіть перевірку.";
  else if (!validFormat) disabledReason = "Введіть 3–30 латинських символів: перша — літера, остання — літера або цифра.";
  else if (unchanged) disabledReason = "Ця адреса вже збережена. Для зміни введіть нове ім’я.";
  else if (lockedUntil !== null) disabledReason = "Змінити адресу можна не частіше ніж раз на 30 днів.";
  else if (!password) disabledReason = "Введіть поточний пароль для підтвердження.";
  else if (recovery && !secondFactor.trim()) disabledReason = "Введіть одноразовий резервний код.";

  return { normalizedName, validFormat, unchanged, lockedUntil, disabledReason };
}
