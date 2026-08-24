import { db } from "../../src/db/knex.js";

// Wipes transactional data between tests; keeps reference seeds
// (accounts, categories, category_rules).
//   No CASCADE: nothing outside this list references these tables, and
//   omitting it means a future table with an FK here fails loudly
//   instead of being silently truncated too.
//   RESTART IDENTITY — resets id sequences so tests can assert on id = 1.
// 4b: add `imports` to the list once M3 creates it.
export function truncateTransactional() {
  return db.raw("TRUNCATE transactions RESTART IDENTITY");
}
