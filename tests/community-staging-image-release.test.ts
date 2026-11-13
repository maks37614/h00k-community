import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(
  new URL("../.github/workflows/community-staging-image.yml", import.meta.url), "utf8",
);
const dockerignore = readFileSync(new URL("../.dockerignore", import.meta.url), "utf8");
const guide = readFileSync(
  new URL("../docs/staging-artifact-release.md", import.meta.url), "utf8",
);

test("staging image is released only by explicit manual dispatch from main", () => {
  assert.match(workflow, /^on:\s*$/m);
  assert.match(workflow, /^  workflow_dispatch:\s*$/m);
  assert.match(workflow, /^  pull_request:\s*$/m);
  assert.doesNotMatch(workflow, /^  push:/m);
  assert.match(workflow, /github\.event_name == 'workflow_dispatch'/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /github\.repository == 'maks37614\/h00k-community'/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /permissions:\s*\n\s*contents: write/);
});

test("CI validates the Docker runtime but cannot publish any release", () => {
  assert.match(workflow, /if: github\.event_name == 'pull_request'/);
  assert.match(workflow, /docker build --tag h00k-community:ci/);
  assert.match(workflow, /test -f \/app\/dist-profile\/community\.html/);
  assert.match(workflow, /test -f \/app\/communityServer\.ts/);
  assert.match(workflow, /test ! -e \/app\/\.env\.community/);
});

test("manual release verifies source and package, signs archive with SHA256", () => {
  for (const command of ["npm ci", "npm run lint", "npm test", "npm run build",
    "docker build --platform linux/amd64", "docker save", "sha256sum",
    "gh release create", "--prerelease", "--target \"$GITHUB_SHA\"",
  ]) assert.ok(workflow.includes(command), command);
  assert.match(workflow, /community-stage-\$\{RELEASE_SHA\}/);
  assert.match(workflow, /if gh release view "\$TAG"/);
  assert.doesNotMatch(workflow, /docker compose (up|down)|ssh |scp |rsync /);
});

test("Docker build context excludes local secrets, backups and user data", () => {
  for (const pattern of ["node_modules", ".env", ".env.*", "server/data",
    "*.pem", "*.key", "*.dump", "*.tar.gz", ".ssh/", "dist",
  ]) assert.ok(dockerignore.split("\n").includes(pattern), pattern);
});

test("deployment guide verifies checksum, preserves PostgreSQL and restarts only Community", () => {
  assert.match(guide, /sha256sum -c h00k-community-image\.tar\.gz\.sha256/);
  assert.match(guide, /sudo docker image load -i h00k-community-image\.tar\.gz/);
  assert.match(guide, /up -d --no-deps community/);
  assert.match(guide, /pg_dump/);
  assert.match(guide, /RELEASE_SHA/);
  assert.match(guide, /community-staging-preflight\.sh/);
});
