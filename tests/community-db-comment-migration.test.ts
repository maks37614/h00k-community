import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { migrate } from "../server/community/db";
import { testDatabase } from "./fixtures/community-db";

test("schema migrations ignore SQL comments with semicolons and can be rerun", async () => {
  const engine = new PGlite();
  try {
    const db = testDatabase(engine);
    await migrate(db);
    await migrate(db);
    const { rows } = await db.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='hc_members' AND column_name='muted'",
    );
    assert.equal(rows[0]?.column_name, "muted");
  } finally {
    await engine.close();
  }
});
