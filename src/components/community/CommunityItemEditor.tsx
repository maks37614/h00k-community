import React, { useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { apiJson } from "../../utils/apiFetch";
import {
  allowedEditAudiences,
  audienceLabel,
  buildEditedItemPayload,
  canSaveEditedContent,
  type CommunityItemAudience,
} from "./editItemPolicy";

type EditableCommunityItem = {
  id: string;
  kind: "post" | "comment";
  revision: number;
  audience: CommunityItemAudience;
  body: Record<string, unknown> & { text?: string; title?: string; photos?: string[] };
};

/**
 * Save edits with server-side optimistic revision checks. No attachments are
 * re-uploaded or exposed to another audience; original charts stay unchanged.
 */
export function CommunityItemEditor({
  item,
  onSaved,
  onCancel,
}: {
  item: EditableCommunityItem;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(item.body?.text ?? "");
  const [audience, setAudience] = useState<CommunityItemAudience>(item.audience);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const canSubmit = canSaveEditedContent(text, item.body ?? {}, busy);
  const audienceOptions = allowedEditAudiences(item.audience);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !canSubmit) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const payload = buildEditedItemPayload(item, text, audience);
      await apiJson("/api/community/items/" + encodeURIComponent(item.id), {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не вдалося зберегти зміни.";
      setError(message);
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  return (
    <form
      className="community-item-editor"
      aria-label={item.kind === "post" ? "Редагування допису" : "Редагування коментаря"}
      onSubmit={(event) => void submit(event)}
    >
      <label className="community-item-editor-label" htmlFor={"community-edit-" + item.id}>
        {item.kind === "post" ? "Змінити текст допису" : "Змінити коментар"}
      </label>
      <textarea
        id={"community-edit-" + item.id}
        value={text}
        maxLength={20_000}
        disabled={busy}
        onChange={(event) => setText(event.target.value)}
        rows={item.kind === "post" ? 5 : 3}
        autoFocus
      />
      <div className="community-item-editor-meta">
        <span>Фото, графіки й джерела залишаються без змін.</span>
        <span>{text.length.toLocaleString("uk-UA")} / 20 000</span>
      </div>
      {item.kind === "post" && audienceOptions.length > 0 && (
        <label className="community-item-editor-audience">
          Кому видно допис
          <select
            value={audience}
            disabled={busy}
            onChange={(event) => setAudience(event.target.value as CommunityItemAudience)}
          >
            {audienceOptions.map((option) => (
              <option key={option} value={option}>{audienceLabel(option)}</option>
            ))}
          </select>
        </label>
      )}
      <p className="community-item-editor-privacy">
        Під час редагування можна звузити аудиторію, але не розширити її.
        Для ширшого доступу створіть окрему публікацію.
      </p>
      {error && <p className="community-item-editor-error" role="alert">{error}</p>}
      <div className="community-item-editor-actions">
        <button type="button" onClick={onCancel} disabled={busy}>
          <X size={15} aria-hidden="true" /> Скасувати
        </button>
        <button type="submit" className="community-primary" disabled={!canSubmit}>
          <Check size={15} aria-hidden="true" /> {busy ? "Зберігаємо…" : "Зберегти зміни"}
        </button>
      </div>
    </form>
  );
}
