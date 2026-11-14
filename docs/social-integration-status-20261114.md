# Social → h00k Community: стан інтеграції (14 листопада 2026)

Вихідний референс: `maks37614/social` (демонстраційний React-застосунок з mockData).
Ціль: `maks37614/h00k-community`, два окремі контексти: приватна авторизована Community і гостьова `/u/maks`.

## Реалізовано в коді

| Блок із social | Реальний Community-компонент / реалізація | Межа |
| --- | --- | --- |
| Структура/кольори/масштаб | social-concept-layout.css, social-profile-hero.css, publicProfileSocialSourceClone.css | 1720px max, публічний банер 208/160px, аватар 128/112px; фактичне вимірювання лише після деплою |
| Стіна, стрічка | CommunityPage / Feed / ItemCard | Справжній PostgreSQL і `policy`, без mock-постів |
| Статті та розбори | Profile / Composer + PublicProfileArticles | Власник створює education-допис із заголовком та контролем аудиторії; публічно видно тільки відкриті |
| HookChart у профілі | Profile / PublicSetupGalleryToolbar / ChartPreview | Auth: доступні за політикою snapshot; guest: тільки відкриті; без live-WebSocket |
| Пошук серед графіків | publicSetupGalleryModel | Фільтрація вже завантажених авторизованих сторінок, не глобальний пошук |
| Реакції, коментарі, вкладення | CommunityReactions, CommunityPhotoGallery, ItemCard | Серверна перевірка дозволів |
| Друзі, особисті та групові чати | Friends, Chats | Тільки після native-входу; гостьовий контакт — посилання, не автоматичний запис |
| Статус, bio, avatar, cover | CommunityConceptProfile, Profile, PublicProfileMediaSettings | Видимість та редагування згідно з правами |
| Сесії, нагороди, результати | CommunityTradingSessions, CommunityAwardPanel, Trades | Реальні акаунтні дані; нуль не підмінюється зразками |
| Історія вкладок | publicProfileViewModel; auth Profile `profileTab` | Back/forward та прямі посилання |

## Цей етап (PR #66)

1. `GET /api/community/feed?owner=...&withChart=1`: відбір лише дописів із графіками **перед** пагінацією, з наявною перевіркою `presentItem`.
2. Авторизований профіль: окрема вкладка HookChart, чотири фільтри, помилки/порожні стани, `load more`.
3. Вкладка Статті: редактор із заголовком, примусовою категорією `education` і вибором аудиторії прямо на сторінці.
4. `profileTab=hookchart` у URL Community, back/forward; адаптивні поля з 16px для iOS.
5. Регресійні тести та CI мають пройти до злиття.

## Що *не* можна механічно копіювати

- Числа Win Rate/PnL, відгуки, статус присутності, бейджі, локацію, фото та активні угоди з `social/mockData`. Вони демонстраційні, а Community відображає лише дозволені реальні дані.
- Гостьові write-дії/приватні API. `/u/maks` залишається read-only.
- Додатковий market-screener/WebSocket на Community. Повний скрінер живе на `h00k.top`, Community отримує лише збережені знімки.
- Міграцію PostgreSQL, SMTP, MFA, злиття ідентичностей і послаблення CSP — цей UI-етап їх не робить.

## Залишкова перевірка після оновлення staging

- Запустити останній **main** Docker image із префіксом правильного SHA; staging може працювати на застарілому образі.
- Порівняти `social` і `community-stage` при 1920, 1440, 1024, 768, 390, 375, 320 px, з однаковим контентом. Перевірити банер, аватар, сайдбари, скрол вкладок, 2/3/6 KPI.
- На реальному iPhone / Android перевірити фокус полів, клавіатуру, прокручування і відсутність горизонтального зсуву.
- Перевірити з двох акаунтів: приватний/для друзів/публічний допис із графіком, статтю, видалення, відгук дозволів у гостьовому профілі, видимість фільтрів і курсорну пагінацію.
- Порівняти реальні шрифти: demo social посилається на зовнішні font-ресурси; Community навмисно не послаблює CSP.

У GitHub CI перевіряє збірку/логіку; до деплою і ручного browser-QA не заявляємо pixel-perfect відповідність чи завершення інтеграції.
