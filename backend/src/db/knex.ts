import knex from "knex";

// Alembic analogy: this is your engine/session setup — one shared
// connection pool the rest of the app imports.
export const db = knex({
  client: "pg",
  connection: process.env.DATABASE_URL,
});
