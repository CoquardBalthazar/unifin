// This files interacts directly with the db via a mock request that returns a row 1
// Goal : health check prooving that the express db is working, not just that the node process is breathing, but that the actual backend is breathing.

import type { Request, Response } from "express";
import { db } from "../db/knex.js";

// Healthcheck for Railway (Phase 8a) and CI. Public on purpose — the
// health prober has no token.
export async function health(_req: Request, res: Response) {
  try {
    // Cheapest possible real round-trip: touches no table, so it stays
    // valid whatever Phase 4 does to the schema.
    await db.raw("SELECT 1");
    res.json({ status: "ok", db: "ok" });
  } catch {
    // 503 Service Unavailable, not 500: the app is fine, a dependency is not.
    // Railway treats any non-2xx as unhealthy and stops routing traffic here.
    res.status(503).json({ status: "ok", db: "down" });
  }
}
