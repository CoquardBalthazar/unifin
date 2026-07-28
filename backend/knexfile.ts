/*The CLI (`npx knex migrate:latest`) reads this file directly
 — it's separate from `knex.ts` because the CLI runs outside
 your app process and needs its own config entry point.*/
import type { Knex } from "knex";

const config: Knex.Config = {
  client: "pg",
  connection: process.env.DATABASE_URL!,
  migrations: {
    directory: "./src/db/migrations",
  },
};

export default config;
