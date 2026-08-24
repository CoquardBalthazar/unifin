import knex from "knex";
import config from "../knexfile.js";

// Runs ONCE per `npm test`, in Vitest's main process — before the first
// test file loads. Not a worker, so `test.env` does NOT apply here:
// process.env.DATABASE_URL still points at the DEV database. Naming
// DATABASE_URL_TEST explicitly is what keeps this off db-unifin.
//
// Migrating here means every test run also exercises M1–M4 —
// free coverage on the riskiest code in this phase.
export async function setup() {
  // Spread first, `connection` after — last key wins.
  const db = knex({ ...config, connection: process.env.DATABASE_URL_TEST! });
  await db.migrate.latest();
  // await db.seed.run();   // ← 4b: accounts, categories, category_rules
  await db.destroy();
}
