# Безпечне оновлення Community staging з `maks37614/h00k-community`

Ця інструкція стосується **лише** `community-stage.h00k.top` на чинному VPS.

**Увага:** це *план розгортання*, не підтвердження, що зміни вже встановлені. На VPS уже працюють `h00k-community-stage-community-1` і `h00k-community-stage-postgres-1`. Новий GitHub репозиторій — це окреме джерело коду, а не автоматичне оновлення поточного контейнера. Перед виконанням звірити фактичні імена, конфігурацію й доступні ресурси.

## Не робити

- Не запускати `docker compose down -v` або `docker volume rm`: це може видалити PostgreSQL і вкладення.
- Не змінювати `/home/ubuntu/h00k`, його контейнер `h00k-app-1` і робочі біржові сервіси.
- Не переписувати `.env.community` новим `.env.example`. У `.env.community` залишаються реальні секрети, ключ шифрування, SMTP та налаштування домену.
- Не виконувати `git pull` у `/home/ubuntu/h00k-community-source` із нового GitHub без окремої міграції: ця папка містить стару гілку іншого репозиторію.
- Не виконувати міграції схеми або імпорт БД під час чисто візуального оновлення.

## 0. Швидка перевірка без внесення змін

Коли на VPS уже є клон нового `h00k-community`, почніть із безпечного скрипта:

```bash
cd /home/ubuntu/h00k-community-release
bash scripts/community-staging-preflight.sh
```

Цей скрипт **нічого не встановлює та не перезапускає**. Він перевіряє healthy-стан двох Community-контейнерів і основного скрінера, локальний та HTTPS health, вільний диск і RAM, чинний образ для можливого відкату. Він не читає вміст `.env.community` і не виводить секрети. Якщо будь-який обов’язковий сервіс не відповідає, завершиться з кодом помилки.

Якщо клону ще немає, спочатку виконайте тільки розділ 3 (отримання коду), поверніться до цієї перевірки, а далі продовжуйте backup і розгортання **лише після оцінки результатів**.

## 1. Передумови й контроль стану

На VPS, без друку секретів:

```bash
cd /home/ubuntu/h00k-community-sidecar
sudo docker compose --env-file .env.community \
  -f deploy/compose.community-sidecar.yaml ps
sudo docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'
df -h /
free -h
```

Переконатися, що обидва Community-контейнери працюють. За наявного малого запасу RAM/диска **не збирати образ під високим навантаженням**: краще збирати на окремій машині та передавати готовий образ або планувати сервісне вікно. GitHub CI перевіряє код, але не встановлює його на VPS.

## 2. Зберегти контрольну копію

У тому ж каталозі:

```bash
umask 077
date -u
OLD_IMAGE="$(sudo docker inspect --format '{{.Config.Image}}' h00k-community-stage-community-1)"
printf 'Старий образ: %s\n' "$OLD_IMAGE"
printf '%s\n' "$OLD_IMAGE" > /home/ubuntu/community-rollback-image.txt

DB_BACKUP="/home/ubuntu/h00k-community-sidecar/community-stage-db-$(date -u +%Y%m%d-%H%M%S).dump"
sudo docker exec h00k-community-stage-postgres-1 \
  pg_dump -U h00k_community -d h00k_community_stage -Fc > "$DB_BACKUP"
test -s "$DB_BACKUP" || { echo 'Резервна копія БД не створена'; exit 1; }

sudo cp -p .env.community ".env.community.backup.$(date -u +%Y%m%d-%H%M%S)"
```

Резервну копію БД бажано також перенести в захищене місце поза VPS. Не публікувати її в GitHub. Старий Docker-образ не видаляти до завершення перевірок.

## 3. Отримати новий код окремо

```bash
cd /home/ubuntu

# Виконати лише якщо каталогу ще немає.
test ! -e h00k-community-release || {
  echo 'Каталог h00k-community-release уже існує; не перезаписувати';
  exit 1;
}

git clone --branch main --single-branch \
  https://github.com/maks37614/h00k-community.git \
  h00k-community-release

cd /home/ubuntu/h00k-community-release
git status -sb
git rev-parse HEAD
```

У поточному проєкті `npm run lint`, `npm test`, `npm run build` перевіряються через GitHub Actions. Порівняти SHA й результат CI із релізом. Гілка `main` може рухатися: **перед розгортанням зафіксувати конкретний SHA**.

## 4. Зібрати окремий образ

**Тільки якщо VPS має достатній запас CPU/RAM/диска** й резервна копія створена. Інакше збирати поза VPS.

```bash
cd /home/ubuntu/h00k-community-release
RELEASE_SHA="$(git rev-parse --short=12 HEAD)"
NEW_IMAGE="h00k-community:$RELEASE_SHA"
printf 'Новий образ: %s\n' "$NEW_IMAGE"
sudo docker build -t "$NEW_IMAGE" .
sudo docker image inspect "$NEW_IMAGE" --format '{{.Id}}'
```

Ця команда **створює** новий образ, але сама не перезапускає Community або PostgreSQL.

## 5. Змінити лише image у staging env

У цьому кроці перемикаємо лише `H00K_COMMUNITY_IMAGE`. Всі інші значення й секрети незмінні.

```bash
cd /home/ubuntu/h00k-community-sidecar
RELEASE_SHA="$(git -C /home/ubuntu/h00k-community-release rev-parse --short=12 HEAD)"
NEW_IMAGE="h00k-community:$RELEASE_SHA"

if [ "$(sudo grep -c '^H00K_COMMUNITY_IMAGE=' .env.community)" != 1 ]; then
  echo 'Зупинено: потрібно рівно один H00K_COMMUNITY_IMAGE у .env.community'
  exit 1
fi

sudo sed -i "s|^H00K_COMMUNITY_IMAGE=.*$|H00K_COMMUNITY_IMAGE=$NEW_IMAGE|" .env.community
sudo docker compose --env-file .env.community \
  -f deploy/compose.community-sidecar.yaml config --services
```

Не виводити повний `docker compose config`, оскільки він може містити розгорнуті значення `DATABASE_URL` й інших секретів.

## 6. Перезапустити тільки Community

```bash
cd /home/ubuntu/h00k-community-sidecar
sudo docker compose --env-file .env.community \
  -f deploy/compose.community-sidecar.yaml \
  up -d --no-deps community

sudo docker compose --env-file .env.community \
  -f deploy/compose.community-sidecar.yaml ps

curl -fsS http://127.0.0.1:3101/api/community-health
curl -fsS https://community-stage.h00k.top/api/community-health
```

**`--no-deps community` важливий:** він не має перезапускати PostgreSQL. Після запуску перевірити, що `h00k-app-1` залишається healthy.

## 7. Ручна перевірка

Провести на мобільному й комп’ютері:
- реєстрація/вхід (використовувати тестовий акаунт), повернення в сеанс;
- стрічка «Публічні/Друзі», пост, реакція, коментар, вкладення графіка;
- профіль, публічний URL, видимість полів;
- пошук друзів, вхідна й вихідна заявка, скасування;
- особисте й групове повідомлення;
- налаштування приватності й відсутність зуму сторінки при фокусі вводу на iPhone;
- відсутність помилок у браузерній консолі та серверних логах.

Після цих перевірок можна готувати окремий реліз. Автоматичні тести не замінюють ручний visual QA.

## 8. Відкат образу, якщо щось пішло не так

Використати збережений образ (БД **не** відновлювати автоматично; візуальний реліз не повинен її змінювати):

```bash
OLD_IMAGE="$(cat /home/ubuntu/community-rollback-image.txt)"
test -n "$OLD_IMAGE" || { echo 'Немає назви старого образу'; exit 1; }
sudo docker image inspect "$OLD_IMAGE" >/dev/null || {
  echo 'Старий образ відсутній; зупинити відкат'; exit 1;
}

cd /home/ubuntu/h00k-community-sidecar
sudo sed -i "s|^H00K_COMMUNITY_IMAGE=.*$|H00K_COMMUNITY_IMAGE=$OLD_IMAGE|" .env.community
sudo docker compose --env-file .env.community \
  -f deploy/compose.community-sidecar.yaml up -d --no-deps community
sudo docker compose --env-file .env.community \
  -f deploy/compose.community-sidecar.yaml ps
```

**Ніколи не робити `down -v` для відкату.** Якщо під час оновлення були створені нові дані, відновлення старої БД може стерти їх. Рішення щодо відновлення БД приймати окремо.

---

Управління Community з GitHub безпечно робити через ізольовані PR, тести й образ із зафіксованим SHA. Сам по собі новий репозиторій не змінює запущений контейнер на VPS.
