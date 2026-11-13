import React, { useState } from "react";
import { apiJson } from "../../utils/apiFetch";
import "./social-reactions.css";

export type CommunityReaction = {
  emoji: string;
  count: number;
  mine?: boolean;
};

export const COMMUNITY_REACTION_CHOICES = ["👍", "❤️", "🔥", "🤔", "👏"] as const;

/** A single authenticated reaction per person, shared by posts and comments. */
export function CommunityReactions({
  itemId,
  reactions,
  run,
  refresh,
  variant = "post",
}: {
  itemId: string;
  reactions?: CommunityReaction[];
  run: (action: () => Promise<unknown>) => Promise<void>;
  refresh: () => void;
  variant?: "post" | "comment";
}) {
  const [busy, setBusy] = useState(false);
  const selected = reactions?.find((reaction) => reaction.mine)?.emoji;

  function toggle(emoji: string) {
    if (busy) return;
    setBusy(true);
    void run(async () => {
      await apiJson("/api/community/items/" + encodeURIComponent(itemId) + "/reaction", {
        method: "POST",
        body: JSON.stringify({ emoji }),
      });
      refresh();
    }).finally(() => setBusy(false));
  }

  return (
    <div
      className={"community-reaction-bar community-reaction-bar-" + variant}
      role="group"
      aria-label={variant === "comment" ? "Реакції на коментар" : "Реакції на публікацію"}
    >
      {COMMUNITY_REACTION_CHOICES.map((emoji) => {
        const count = reactions?.find((reaction) => reaction.emoji === emoji)?.count ?? 0;
        const pressed = selected === emoji;
        return (
          <button
            type="button"
            className={pressed ? "community-reaction-active" : undefined}
            key={emoji}
            disabled={busy}
            aria-pressed={pressed}
            aria-label={pressed ? `Прибрати реакцію ${emoji}` : `Поставити реакцію ${emoji}`}
            title={pressed ? "Прибрати реакцію" : "Поставити реакцію"}
            onClick={() => toggle(emoji)}
          >
            <span aria-hidden="true">{emoji}</span>
            {count > 0 && <span className="community-reaction-count">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
