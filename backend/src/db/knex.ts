import knex from "knex";

// Alembic analogy: this is your engine/session setup — one shared
// connection pool the rest of the app imports.

// client : indicate to knex which driver/dialect to use for both connecting and generating SQL syntax
// connection : a single connection string (what you're using): postgres://user:password@host:port/database — this is what you have via process.env.DATABASE_URL!.
// or an object with the pieces broken out separately:
// connection: {
//   host: 'postgres',
//   port: 5432,
//   user: 'u-unifin',
//   password: 'pw-unifin',
//   database: 'db-unifin',
// }

export const db = knex({
  client: "pg",
  connection: process.env.DATABASE_URL!,
});
