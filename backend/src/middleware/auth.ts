import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Express middleware ≈ a decorator wrapping every route it's applied to:
// runs before the controller, can short-circuit the request (401) or
// call next() to let it continue.

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization; // "Bearer eyJhbGc..."
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET!);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
