#!/usr/bin/env bash
# Read-only audit before updating community-stage.h00k.top.
# Does not deploy images, inspect secrets, run migrations or change containers.
set -uo pipefail

SIDECAR="/home/ubuntu/h00k-community-sidecar"
COMPOSE="$SIDECAR/deploy/compose.community-sidecar.yaml"
ENV_FILE="$SIDECAR/.env.community"
APP_CONTAINER="h00k-community-stage-community-1"
DB_CONTAINER="h00k-community-stage-postgres-1"
MARKET_CONTAINER="h00k-app-1"
problems=0

info() { printf '[INFO] %s\n' "$*"; }
warn() { printf '[WARN] %s\n' "$*"; }
error() { printf '[FAIL] %s\n' "$*"; problems=$((problems + 1)); }

info "Перевірка Community staging без внесення змін"
info "Каталог sidecar: $SIDECAR"

for program in sudo docker curl awk df; do
  if ! command -v "$program" >/dev/null 2>&1; then
    error "Не знайдено команду: $program"
  fi
done

if (( problems > 0 )); then
  exit 1
fi

if ! sudo test -f "$COMPOSE"; then
  error "Не знайдено Docker Compose: $COMPOSE"
fi
if ! sudo test -f "$ENV_FILE"; then
  error "Не знайдено .env.community. Створювати або копіювати секрети не потрібно."
fi
if (( problems > 0 )); then
  exit 1
fi

info "Контейнери (тільки читання)"
if ! sudo docker compose --env-file "$ENV_FILE" -f "$COMPOSE" ps; then
  error "Docker Compose не вдалося прочитати."
fi

check_container() {
  local container="$1" health
  health="$(sudo docker inspect \
    --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
    "$container" 2>/dev/null)" || {
      error "$container відсутній"
      return
    }
  if [[ "$health" == "healthy" ]]; then
    info "$container: healthy"
  elif [[ "$health" == "running" ]]; then
    warn "$container працює, але healthcheck не налаштовано"
  else
    error "$container: $health"
  fi
}

check_container "$APP_CONTAINER"
check_container "$DB_CONTAINER"
check_container "$MARKET_CONTAINER"

current_image="$(sudo docker inspect \
  --format '{{.Config.Image}}' "$APP_CONTAINER" 2>/dev/null || true)"
if [[ -n "$current_image" ]]; then
  info "Поточний Community image: $current_image"
  if ! sudo docker image inspect "$current_image" >/dev/null 2>&1; then
    warn "Образ за тегом недоступний локально; перевірити можливість відкату."
  fi
fi

info "Ресурси VPS"
df -h /
if command -v free >/dev/null 2>&1; then free -h; fi
if command -v nproc >/dev/null 2>&1; then info "CPU: $(nproc) логічних ядер"; fi

disk_free_kib="$(df -Pk / | awk 'NR == 2 {print $4}')"
memory_available_kib="$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)"
if [[ "$disk_free_kib" =~ ^[0-9]+$ ]] && (( disk_free_kib < 5 * 1024 * 1024 )); then
  warn "На диску менше 5 GiB вільно. Не збирайте Docker-образ на цьому VPS."
fi
if [[ "$memory_available_kib" =~ ^[0-9]+$ ]] && (( memory_available_kib < 1024 * 1024 )); then
  warn "Доступно менше 1 GiB RAM. Рекомендована збірка на іншому комп'ютері."
fi

check_health() {
  local label="$1" url="$2"
  if curl --fail --silent --show-error --max-time 10 --output /dev/null "$url"; then
    info "$label: HTTP OK"
  else
    error "$label недоступний: $url"
  fi
}

info "Перевірка health без друку відповідей"
check_health "Community local" "http://127.0.0.1:3101/api/community-health"
check_health "Community HTTPS" "https://community-stage.h00k.top/api/community-health"
check_health "Screener local" "http://127.0.0.1:3000/api/health"

printf '\n'
if (( problems > 0 )); then
  info "Виявлено проблем: $problems. Розгортання потрібно відкласти."
  exit 1
fi

info "Базові перевірки пройдено. Це НЕ перевірка резервної копії та НЕ дозвіл на автоматичний деплой."
info "Перед оновленням: backup PostgreSQL, збереження поточного image і перевірка SHA релізу."
info "Детальна інструкція: docs/deploy-from-community-github.md"
