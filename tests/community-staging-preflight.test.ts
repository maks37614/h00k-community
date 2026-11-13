import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const url = new URL("../scripts/community-staging-preflight.sh", import.meta.url);
const script = readFileSync(url, "utf8");

test("preflight script parses as valid bash", () => {
  const result = spawnSync("bash", ["-n", url.pathname], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});

test("preflight reads the right sidecar and existing container health", () => {
  assert.match(script, /h00k-community-sidecar/);
  assert.match(script, /h00k-community-stage-community-1/);
  assert.match(script, /h00k-community-stage-postgres-1/);
  assert.match(script, /h00k-app-1/);
  assert.match(script, /docker compose --env-file "\$ENV_FILE" -f "\$COMPOSE" ps/);
  assert.match(script, /docker inspect/);
  assert.match(script, /api\/community-health/);
  assert.match(script, /api\/health/);
  assert.match(script, /MemAvailable/);
});

test("preflight never reveals secret file contents or mutates Docker", () => {
  assert.doesNotMatch(script, /docker (?:compose .* )?(?:up|down|build|restart|stop|rm|volume rm|prune|image rm)\b/);
  assert.doesNotMatch(script, /\b(?:cat|source|printenv|env)\s+"\$ENV_FILE"/);
  assert.doesNotMatch(script, /sed -i|docker exec|pg_restore|psql|pg_dump|git pull/);
  assert.match(script, /sudo test -f "\$ENV_FILE"/);
});
