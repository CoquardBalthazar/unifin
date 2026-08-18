import request from "supertest";
import { app } from "../index.js";
import { db } from "../db/knex.js";

import { test, expect, afterAll } from "vitest";

afterAll(async () => {
  await db.destroy();
});

// successful response
test("GET /health returns 200 with db ok", async () => {
  const res = await request(app).get("/health");
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: "ok", db: "ok" });
});

// no/bad token error absent
test("GET /health needs no Authorization header", async () => {
  const res = await request(app).get("/health");
  expect(res.status).not.toBe(401);
});
