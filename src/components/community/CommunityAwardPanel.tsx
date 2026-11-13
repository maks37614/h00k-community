import React, { useEffect, useState } from "react";
import { Award, ChevronRight, Gift, Info, Star, Trophy } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../utils/apiFetch";

type AwardType = "thanks" | "analysis" | "top_trader";
const awards: { id: AwardType; label: string; price: number; icon: React.ReactNode }[] = [
  { id: "thanks", label: "Подяка", price: 20, icon: <Trophy size={34} /> },
  { id: "analysis", label: "Крутий аналіз", price: 50, icon: <Star size={34} /> },
  { id: "top_trader", label: "Топ трейдер", price: 50, icon: <Award size={34} /> },
];

/** Only server-confirmed awards are shown; demo balances from social are never used. */
export function CommunityAwardPanel({
  recipient, onGifted, onFriends, onClear,
}: {
  recipient: { id: string; name: string } | null;
  onGifted: () => void;
  onFriends: () => void;
  onClear: () => void;
}) {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<{ balance: number; received: number; gifted: number } | null>(null);
  const [selection, setSelection] = useState<AwardType>("analysis");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!user) return;
    let live = true;
    void apiJson("/api/community/awards").then(data => {
      if (live) setWallet(data);
    }).catch(error => {
      if (live) setFeedback(error instanceof Error ? error.message : "Не вдалося завантажити баланс");
    });
    return () => { live = false; };
  }, [user?.uid, version]);
  const selected = awards.find(a => a.id === selection)!;
  const send = async () => {
    if (!recipient || !wallet || busy || wallet.balance < selected.price) return;
    if (!window.confirm("Подарувати «" + selected.label + "» користувачу " + recipient.name + " за " + selected.price + " балів?")) return;
    setBusy(true);
    setFeedback("");
    try {
      await apiJson("/api/community/awards", {
        method: "POST",
        body: JSON.stringify({ recipientId: recipient.id, awardType: selection }),
      });
      setFeedback("Нагороду подаровано " + recipient.name);
      setVersion(v => v + 1);
      onGifted();
      onClear();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Не вдалося надіслати нагороду");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="community-concept-awards" aria-label="Нагороди трейдерів">
      <h3><Gift size={21} /> Нагороди трейдерів <Info size={15} aria-label="Вартість нагород списується з вашого балансу" /></h3>
      <p>Подякуйте за корисний аналіз, ідею чи допомогу у спільноті. Вартість списується з вашого балансу.</p>
      <div className="community-concept-award-options" role="group" aria-label="Тип нагороди">
        {awards.map(a => <button
          type="button" key={a.id} aria-pressed={selection === a.id}
          className={"community-concept-award " + (selection === a.id ? "community-concept-award-selected" : "")}
          onClick={() => setSelection(a.id)}
        ><span className="community-concept-award-icon">{a.icon}</span><strong>{a.label}</strong><small>{a.price} балів</small></button>)}
      </div>
      {recipient ? (
        <p className="community-concept-award-recipient">Отримувач: <strong>{recipient.name}</strong> <button type="button" onClick={onClear} aria-label="Скасувати вибір отримувача">×</button></p>
      ) : (
        <p className="community-concept-award-recipient">Для подарунка виберіть автора публікації через кнопку «Нагородити».</p>
      )}
      <button type="button" className="community-concept-award-send" onClick={() => void send()}
        disabled={!recipient || !wallet || busy || wallet.balance < selected.price}>
        <Gift size={18} /> {busy ? "Надсилаємо…" : "Подарувати"}
      </button>
      {recipient && wallet && wallet.balance < selected.price && <p role="status">Недостатньо балів для цієї нагороди.</p>}
      {feedback && <p role="status">{feedback}</p>}
      <button type="button" className="community-concept-wallet" onClick={onFriends}>
        <Star size={17} /> Ваш баланс балів: <strong>{wallet ? wallet.balance : "—"}</strong><ChevronRight size={16} />
      </button>
    </section>
  );
}
