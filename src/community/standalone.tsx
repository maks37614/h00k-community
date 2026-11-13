import React, { lazy, Suspense, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChartNoAxesCombined,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { ArchiveProvider } from "../context/ArchiveContext";
import { AuthModal } from "../components/AuthModal";
import "../index.css";
import "../components/community/community.css";
import "./standalone.css";

const Community = lazy(() =>
  import("../components/community/CommunityPage").then((m) => ({
    default: m.CommunityPage,
  })),
);

const features = [
  {
    icon: <ChartNoAxesCombined size={22} aria-hidden="true" />,
    title: "Формації та графіки",
    text: "Додавайте збережені розбори HookChart до публікацій і коментарів.",
  },
  {
    icon: <UsersRound size={22} aria-hidden="true" />,
    title: "Друзі та стрічка",
    text: "Переглядайте загальні дописи або публікації підтверджених друзів.",
  },
  {
    icon: <MessageCircle size={22} aria-hidden="true" />,
    title: "Особисті й групові чати",
    text: "Спілкуйтеся з трейдерами, відповідайте на дописи й обговорюйте ідеї.",
  },
  {
    icon: <BookOpen size={22} aria-hidden="true" />,
    title: "Щоденник і стратегії",
    text: "Зберігайте плани, торгові нотатки й власні робочі матеріали.",
  },
] as const;

function GuestLanding({ onAuth }: { onAuth: (mode: "signin" | "signup") => void }) {
  return (
    <main className="community-guest" aria-label="Про h00k Community">
      <section className="community-guest-hero">
        <div className="community-guest-hero-copy">
          <span className="community-guest-kicker">
            <span className="community-guest-live-dot" aria-hidden="true" />
            СОЦІАЛЬНИЙ ПРОСТІР ДЛЯ ТРЕЙДЕРІВ
          </span>
          <h1>
            Торгуйте з власним планом.
            <span> Обговорюйте з командою.</span>
          </h1>
          <p>
            h00k Community поєднує стрічку публікацій, друзів, спілкування,
            трейдерські щоденники й збережені розбори HookChart. Ви вирішуєте,
            кому показувати кожну публікацію та дані профілю.
          </p>
          <div className="community-guest-hero-actions">
            <button
              type="button"
              className="community-guest-primary"
              onClick={() => onAuth("signup")}
            >
              Створити профіль <ArrowRight size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="community-guest-secondary"
              onClick={() => onAuth("signin")}
            >
              Уже є акаунт? Увійти
            </button>
          </div>
          <div className="community-guest-trust">
            <span><ShieldCheck size={16} aria-hidden="true" /> Контроль приватності</span>
            <span><LockKeyhole size={16} aria-hidden="true" /> Власна авторизація</span>
          </div>
        </div>
        <div className="community-guest-product" aria-label="Можливості спільноти">
          <div className="community-guest-product-top">
            <span className="community-guest-product-icon"><UsersRound size={18} aria-hidden="true" /></span>
            <span>Твій простір у Community</span>
          </div>
          <div className="community-guest-product-main">
            <div className="community-guest-product-label">СПІЛЬНОТА · ІДЕЇ · АНАЛІЗ</div>
            <h2>Усе навколо вашого торгового процесу</h2>
            <p>Реальні публікації та розмови з'являються після входу.</p>
          </div>
          <div className="community-guest-product-tiles">
            <div>
              <span className="community-guest-tile-icon"><ChartNoAxesCombined size={19} aria-hidden="true" /></span>
              <strong>HookChart</strong>
              <small>Розбір графіка</small>
            </div>
            <div>
              <span className="community-guest-tile-icon"><MessageCircle size={19} aria-hidden="true" /></span>
              <strong>Чати</strong>
              <small>Командні розмови</small>
            </div>
            <div>
              <span className="community-guest-tile-icon"><UsersRound size={19} aria-hidden="true" /></span>
              <strong>Друзі</strong>
              <small>Своя стрічка</small>
            </div>
          </div>
          <div className="community-guest-product-foot">
            <ShieldCheck size={16} aria-hidden="true" />
            Публічність визначає власник акаунта
          </div>
        </div>
      </section>

      <section className="community-guest-features" aria-labelledby="community-guest-features-title">
        <div className="community-guest-section-head">
          <span className="community-guest-kicker">ІНСТРУМЕНТИ СПІЛЬНОТИ</span>
          <h2 id="community-guest-features-title">Більше, ніж просто стрічка</h2>
          <p>Окремий простір для взаємодії трейдерів, інтегрований із функціями h00k.</p>
        </div>
        <div className="community-guest-feature-grid">
          {features.map(({ icon, title, text }) => (
            <article key={title} className="community-guest-feature">
              <div className="community-guest-feature-icon">{icon}</div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="community-guest-privacy" aria-label="Безпека та приватність">
        <div className="community-guest-privacy-icon"><ShieldCheck size={29} aria-hidden="true" /></div>
        <div>
          <span className="community-guest-kicker">ПРИВАТНІСТЬ ПЕРШ ЗА ВСЕ</span>
          <h2>Ваші дані — ваш вибір</h2>
          <p>
            Профіль і торгові показники не стають публічними автоматично.
            Для дописів є окремі аудиторії, а статистика й деталі угод мають
            власні налаштування видимості. Біржові підключення, якщо ви їх
            додаєте, повинні мати лише права читання.
          </p>
        </div>
        <button type="button" onClick={() => onAuth("signup")}>
          Приєднатися <ArrowRight size={16} aria-hidden="true" />
        </button>
      </section>
    </main>
  );
}

function Workspace() {
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState("");
  const resetting = new URLSearchParams(location.search).has("reset");

  const openAuth = (mode: "signin" | "signup") => {
    setAuthMode(mode);
    setOpen(true);
  };

  return (
    <div className="community-standalone" data-network-mode="community-only">
      <header className="community-standalone-header">
        <div className="community-standalone-header-inner">
          <a className="community-standalone-brand" href="/" aria-label="h00k Community — головна">
            <span className="community-standalone-brand-mark" aria-hidden="true">h</span>
            <span>h00k <strong>Community</strong></span>
          </a>
          <nav className="community-standalone-header-actions" aria-label="Навігація">
            <a href="https://h00k.top" className="community-standalone-screener">
              <ChartNoAxesCombined size={17} aria-hidden="true" /> Скрінер
            </a>
            <a href="https://h00k.top/#terminal" className="community-standalone-screener">HookChart</a>
            {user && (
              <>
                <a className="community-standalone-active" href="#community?section=feed"><UsersRound size={17} /> Community</a>
                <a href="#community?section=friends">Друзі</a>
                <a href="#community?section=chats"><MessageCircle size={17} /> Повідомлення</a>
                <a href="#community?section=profile">Профіль</a>
              </>
            )}
            {user ? (
              <button type="button" onClick={() => void logout().catch(e => setError(e.message))}>
                Вийти
              </button>
            ) : !loading && !resetting ? (
              <button type="button" className="community-standalone-login" onClick={() => openAuth("signin")}>
                Увійти
              </button>
            ) : null}
          </nav>
        </div>
      </header>

      {error && <p className="community-standalone-error" role="alert">{error}</p>}
      {loading ? (
        <main className="community-standalone-loading" role="status">Перевіряємо сеанс…</main>
      ) : user && !resetting ? (
        <main className="community-standalone-app">
          <Suspense fallback={<p className="community-standalone-loading" role="status">Відкриваємо спільноту…</p>}>
            <Community onReplay={() => { location.href = "https://h00k.top/#replay"; }} />
          </Suspense>
        </main>
      ) : resetting ? (
        <main className="community-standalone-loading" role="status">Оновлення пароля</main>
      ) : (
        <GuestLanding onAuth={openAuth} />
      )}

      {!user && !loading && !resetting && (
        <footer className="community-guest-footer">
          <span>© 2026 h00k Community</span>
          <span>Обговорення ринку не є фінансовою рекомендацією.</span>
        </footer>
      )}

      <AuthModal
        isOpen={!loading && (resetting || (!user && open))}
        initialMode={authMode}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
createRoot(document.getElementById("community-root")!).render(
  <AuthProvider><ArchiveProvider><Workspace /></ArchiveProvider></AuthProvider>,
);
