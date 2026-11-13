import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getProfileAddressState,
  type ProfileAddressInfo,
} from "../src/components/community/profileAddressState";

const verified: ProfileAddressInfo = {
  username: null,
  emailVerified: true,
  changeAllowedAt: null,
};

test("username client preview uses the same ASCII format and normalization as the server", () => {
  const valid = getProfileAddressState("  Trader-Ivan  ", "password", verified, true, false, false, "");
  assert.equal(valid.normalizedName, "trader-ivan");
  assert.equal(valid.validFormat, true);
  assert.equal(valid.disabledReason, null);

  for (const invalid of ["x", "ab", "-ivan", "ivan-", "ivan_1", "іvan", "a".repeat(31)]) {
    assert.equal(
      getProfileAddressState(invalid, "password", verified, true, false, false, "").validFormat,
      false,
      invalid,
    );
  }
});

test("save is unavailable when email is unverified or the current password is missing", () => {
  assert.match(
    getProfileAddressState("trader-ivan", "password", verified, false, false, false, "").disabledReason ?? "",
    /Підтвердіть email/,
  );
  assert.match(
    getProfileAddressState("trader-ivan", "", verified, true, false, false, "").disabledReason ?? "",
    /Введіть поточний пароль/,
  );
  assert.match(
    getProfileAddressState("trader-ivan", "password", null, false, false, false, "").disabledReason ?? "",
    /Перевіряємо стан/,
  );
});

test("30-day cooldown is enforced in UI for changes, but not misreported as an editable name", () => {
  const now = Date.parse("2026-11-13T12:00:00Z");
  const data: ProfileAddressInfo = {
    username: "old-name",
    emailVerified: true,
    changeAllowedAt: "2026-12-05T12:00:00Z",
  };
  const locked = getProfileAddressState("new-name", "password", data, true, false, false, "", now);
  assert.equal(locked.lockedUntil, Date.parse(data.changeAllowedAt!));
  assert.match(locked.disabledReason ?? "", /30 днів/);

  const unchanged = getProfileAddressState(" OLD-NAME ", "password", data, true, false, false, "", now);
  assert.equal(unchanged.unchanged, true);
  assert.equal(unchanged.lockedUntil, null);
  assert.match(unchanged.disabledReason ?? "", /вже збережена/);

  const expired = getProfileAddressState("new-name", "password", data, true, false, false, "", Date.parse("2026-12-06T12:00:00Z"));
  assert.equal(expired.lockedUntil, null);
  assert.equal(expired.disabledReason, null);
});

test("backup-code mode requires code and pending requests cannot submit twice", () => {
  assert.match(
    getProfileAddressState("trader-ivan", "password", verified, true, false, true, "").disabledReason ?? "",
    /резервний код/,
  );
  assert.equal(
    getProfileAddressState("trader-ivan", "password", verified, true, false, true, "backup-123").disabledReason,
    null,
  );
  assert.match(
    getProfileAddressState("trader-ivan", "password", verified, true, true, false, "").disabledReason ?? "",
    /попередню дію/,
  );
});

test("profile editor includes visible verification, successful-save and error states", () => {
  const page = readFileSync(
    new URL("../src/components/community/PublicProfileSettings.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(
    new URL("../src/components/community/profile-address.css", import.meta.url),
    "utf8",
  );
  assert.match(page, /"\/api\/account\/username"/);
  assert.match(page, /getProfileAddressState\(/);
  assert.match(page, /Оновити перевірку/);
  assert.match(page, /Зберегти адресу/);
  assert.match(page, /role=\{notice\.kind === "error" \? "alert" : "status"\}/);
  assert.match(page, /community-profile-address-reason/);
  assert.match(page, /disabled=\{!!address\.disabledReason\}/);
  assert.match(page, /publicProfileEnabled: next/);
  assert.match(page, /disabled=\{busy \|\| !info\?\.username\}/);
  assert.match(css, /font-size: 16px;/);
  assert.match(css, /@media \(max-width: 700px\)/);
});
