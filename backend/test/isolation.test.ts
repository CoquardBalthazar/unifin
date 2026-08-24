import { describe, test, expect, afterAll } from "vitest";
import { db } from "../src/db/knex.js";

afterAll(async () => {
  await db.destroy();
});

describe("test database isolation", () => {
  test("the suite is connected to db-unifin-test, not db-unifin", async () => {
    const { rows } = await db.raw("SELECT current_database() AS name");
    expect(rows[0].name).toBe("db-unifin-test");
  });

  // Un-skip in 4b: needs M2 (`categories`) + the seeds, and the
  // `db.seed.run()` line in globalSetup.ts uncommented.
  test.skip("reference seeds are present", async () => {
    // `noUncheckedIndexedAccess` types rows[0] as possibly-undefined, so
    // destructuring `{ count }` straight out of it won't compile. Postgres
    // always returns one row for COUNT(*), but the type system can't know
    // that — hence `?.`. If it ever were undefined, Number(undefined) is
    // NaN and NaN > 0 is false, so the test fails loudly rather than passing.
    const [row] = await db("categories").count({ count: "*" });
    expect(Number(row?.count)).toBeGreaterThan(0);
  });
});
