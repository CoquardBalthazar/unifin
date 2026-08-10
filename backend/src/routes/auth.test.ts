import request from "supertest";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { app } from "../index.js";
import { describe, test, expect, beforeAll } from "vitest";

// Throwaway test-only credentials — never your real admin login.
// Overriding process.env here means the login controller (which reads
// process.env.ADMIN_EMAIL / ADMIN_PASSWORD_HASH) checks against these
// instead of whatever's really in backend/.env.
const TEST_EMAIL = "test@unifin.local";
const TEST_PASSWORD = "test-password-not-real";

beforeAll(() => {
  process.env.ADMIN_EMAIL = TEST_EMAIL;
  process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 10);
});

// Test Login
describe("POST /api/auth/login/", () => {
  test("Valid email + Valid Password -> 200 and a token", async () => {
    const res = await request(app)
      .post("/api/auth/login/")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
  });

  test("valid email + wrong password → 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: TEST_EMAIL, password: "wrong-password" });

    expect(res.status).toBe(401);
  });

  test("unknown email → 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@unifin.local", password: TEST_PASSWORD });

    expect(res.status).toBe(401);
  });

  test("missing password → 400", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: TEST_EMAIL });

    expect(res.status).toBe(400);
  });
});

// MIDDLEWARE TESTING on /api/transactions/
describe("requireAuth middleware (via /api/transactions)", () => {
  test("no Authorization header → 401", async () => {
    const res = await request(app).get("/api/transactions");
    expect(res.status).toBe(401);
  });

  test("garbage token → 401", async () => {
    const res = await request(app)
      .get("/api/transactions")
      .set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  test("expired token → 401", async () => {
    const expired = jwt.sign({ sub: TEST_EMAIL }, process.env.JWT_SECRET!, {
      expiresIn: "-1s",
    });
    const res = await request(app)
      .get("/api/transactions")
      .set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });

  test("valid token → passes through", async () => {
    const valid = jwt.sign({ sub: TEST_EMAIL }, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });
    const res = await request(app)
      .get("/api/transactions")
      .set("Authorization", `Bearer ${valid}`);
    expect(res.status).toBe(200);
  });
});
