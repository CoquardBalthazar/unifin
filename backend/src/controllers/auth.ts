import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  const isEmailCorrect = email === process.env.ADMIN_EMAIL;
  const isPasswordCorrect = isEmailCorrect
    ? await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH!)
    : false;

  if (!isEmailCorrect || !isPasswordCorrect) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Arg 1 (payload) — what to embed. Here just the email, so later requests know who the token belongs to.
  // Arg 2 (secret) — the random 32-byte hex string generated once with crypto.randomBytes. This never leaves your server and is the one piece of information that lets your server prove it issued this token.
  // Arg 3 (options) — expiresIn: '7d' gets baked into the payload automatically as an exp (expiry) claim.
  const token = jwt.sign({ sub: email }, process.env.JWT_SECRET!, {
    expiresIn: "7d",
  });

  res.json({ token });
}
