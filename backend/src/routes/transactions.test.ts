import request from "supertest";
import { app } from "../index.js";
import { db } from "../db/knex.js";
import { describe, test, expect, beforeEach, afterAll } from "vitest";

// Change the db to test-db when in production
// Practical implication worth flagging clearly: because this
// hits your real dev database, running the test suite wipes
// out any real data you've manually inserted
beforeEach(async () => {
  // TRUNCATE TABLE transactions. Deletes every row in the table, instantly, and resets the
  // auto-increment counter (so the next inserted row gets id = 1
  await db("transactions").truncate(); // clean slate per test — no leftover rows between tests
});

afterAll(async () => {
  // closes Knex's connection pool to Postgres entirely
  await db.destroy(); // closes the pool, or Vitest hangs waiting for open handles
});

describe("Integration Test - api/transactions", () => {
  test("GET /api/transactions returns 200 and an empty array", async () => {
    const res = await request(app).get("/api/transactions");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test("POST /api/transactions with missing fields returns 400", async () => {
    const res = await request(app)
      .post("/api/transactions")
      .send({ date: "2026-07-27" });
    expect(res.status).toBe(400);
  });

  test("GET /api/transactions/:id returns 404 for unknown id", async () => {
    const res = await request(app).get("/api/transactions/9999");
    expect(res.status).toBe(404);
  });
  //   It's chainable, and returns a real response object you assert on, same shape as res on the server side:
  // const res = await request(app).post('/api/transactions').send({ date: '2026-07-28', ... });
  // res.status   // e.g. 201
  // res.body     // parsed JSON, e.g. { id: 1, date: '2026-07-28', ... }
  // res.headers  // real HTTP headers, e.g. res.headers['content-type']

  // .send(obj) is Supertest's equivalent of fetch's
  // body: JSON.stringify(obj) — it also sets Content-Type:
  // application/json for you automatically.
});
