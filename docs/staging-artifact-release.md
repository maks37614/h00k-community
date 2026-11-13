# Community staging: GitHub збирає Docker-образ, VPS лише завантажує

**Мета:** уникнути `docker build` на VPS із 2 CPU / ~4 GiB RAM. Новий образ
збирається у GitHub Actions на `linux/amd64`, проходить перевірки й публікується
в **ручному GitHub pre-release**. Це не встановлює його автоматично.

## 1. Створити release у GitHub (без SSH)

1. Відкрити [Community staging image workflow](https://github.com/maks37614/h00k-community/actions/workflows/community-staging-image.yml).
2. Натиснути **Run workflow**, обрати гілку **main** та підтвердити.
3. Дочекатися зеленого workflow. Якщо він червоний — **нічого не встановлювати**.
4. Відкрити [Releases](https://github.com/maks37614/h00k-community/releases). Знайти
   **Community staging <12-символьний SHA>** зі статусом pre-release.
5. Записати цей SHA із назви release і перевірити, що він відповідає workflow commit.

Release містить:
- `h00k-community-image.tar.gz`: готовий Docker-образ;
- `h00k-community-image.tar.gz.sha256`: контрольна сума;
- точний коміт у назві тега `community-stage-<SHA>`.

**Не запускайте workflow з іншої гілки.** Налаштовано публікацію тільки з `main`.
Не потрібно видавати токен VPS або дозволи на автоматичний деплой.

## 2. Перевірка VPS перед завантаженням

Виконати на VPS в терміналі:

```bash
cd /home/ubuntu/h00k-community-release
bash scripts/community-staging-preflight.sh

# Окремо перевірити наявність місця.
df -h /
free -h
```

Якщо каталогу `h00k-community-release` ще немає, виконати розділ 3 документа
[deploy-from-community-github.md](deploy-from-community-github.md) для клонування.
Ці перевірки не перезапускають сервіси.

## 3. Завантажити та перевірити готовий образ (без збірки)

Замінити `RELEASE_SHA` **точними 12 символами** SHA з GitHub release:

```bash
RELEASE_SHA="ВСТАВ_12_СИМВОЛІВ"
[[ "$RELEASE_SHA" =~ ^[0-9a-f]{12}$ ]] || {
  echo 'Неправильний SHA; зупинено'; exit 1;
}

umask 077
mkdir -p /home/ubuntu/community-image-download
cd /home/ubuntu/community-image-download

BASE="https://github.com/maks37614/h00k-community/releases/download/community-stage-$RELEASE_SHA"
curl -fL --retry 3 --output h00k-community-image.tar.gz \
  "$BASE/h00k-community-image.tar.gz"
curl -fL --retry 3 --output h00k-community-image.tar.gz.sha256 \
  "$BASE/h00k-community-image.tar.gz.sha256"

sha256sum -c h00k-community-image.tar.gz.sha256 || {
  echo 'Не збігається контрольна сума! Не завантажувати образ.'; exit 1;
}

sudo docker image load -i h00k-community-image.tar.gz

NEW_IMAGE="h00k-community:$RELEASE_SHA"
sudo docker image inspect "$NEW_IMAGE" --format '{{.Id}}'
```

Цей етап **не перезапускає контейнери**. Якщо немає місця на диску — зупинитися.
Не видаляти старий образ до завершення тестів і не робити `docker system prune`.

## 4. Резервна копія перед зміною активного Community

Перед перемиканням обов'язково виконати секцію **2** із
[deploy-from-community-github.md](deploy-from-community-github.md): зберегти
старий образ, копію `.env.community`, `pg_dump` PostgreSQL та, за потреби,
резервну копію медіафайлів.

**Заборонено:** `docker compose down -v`, видалення PostgreSQL-томів,
копіювання `.env.example` поверх `.env.community`.

## 5. Перемкнути лише Community після резервного копіювання

Лише якщо попередні етапи завершено успішно:

```bash
cd /home/ubuntu/h00k-community-sidecar

test -n "$RELEASE_SHA" || { echo 'RELEASE_SHA не встановлено'; exit 1; }
NEW_IMAGE="h00k-community:$RELEASE_SHA"
sudo docker image inspect "$NEW_IMAGE" >/dev/null || {
  echo 'Немає перевіреного образу'; exit 1;
}

if [ "$(sudo grep -c '^H00K_COMMUNITY_IMAGE=' .env.community)" != 1 ]; then
  echo 'Не знайдено єдине поле H00K_COMMUNITY_IMAGE'; exit 1;
fi
sudo sed -i "s|^H00K_COMMUNITY_IMAGE=.*$|H00K_COMMUNITY_IMAGE=$NEW_IMAGE|" .env.community

sudo docker compose --env-file .env.community \
  -f deploy/compose.community-sidecar.yaml \
  up -d --no-deps community

sudo docker compose --env-file .env.community \
  -f deploy/compose.community-sidecar.yaml ps
curl -fS --max-time 10 http://127.0.0.1:3101/api/community-health
curl -fS --max-time 10 https://community-stage.h00k.top/api/community-health
```

**Важливо:** виконувати команду `up` тільки після backup. Налаштування
PostgreSQL, секретів, Nginx та основного скрінера не змінювати.

## 6. Visual QA і відкат

Перевірити на телефоні та комп’ютері вхід, стрічку, реакції, друзів,
заявки, повідомлення, профілі, збереження адреси, приватність,
коментарі й прикріплені графіки.

Якщо з'явилася регресія, використати розділ **8** документа
[deploy-from-community-github.md](deploy-from-community-github.md), щоб
повернути тільки старий образ Community **без відновлення PostgreSQL**.

Залишити реліз `community-stage-<SHA>` як точку ідентифікації збірки.
Після успішної перевірки локальний стиснутий tar можна видалити для
звільнення диска, але не старий Docker-образ до впевненого підтвердження.
