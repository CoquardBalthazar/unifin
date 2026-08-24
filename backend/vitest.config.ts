import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

// This config file is evaluated in Node before any test worker spawns —
// the only place we can read .env and swap the DB URL *before*
// src/db/knex.ts is imported anywhere.
dotenv.config();

export default defineConfig({
  test: {
    // Injected into process.env inside each worker, before module load.
    env: {
      DATABASE_URL: process.env.DATABASE_URL_TEST!,
      NODE_ENV: "test",
    },
    globalSetup: "./test/globalSetup.ts",
    // One shared database. With parallelism on, two files would
    // TRUNCATE each other's fixtures mid-assertion.
    fileParallelism: false,
  },
});
