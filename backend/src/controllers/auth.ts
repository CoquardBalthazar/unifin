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

  const token = jwt.sign({ sub: email }, process.env.JWT_SECRET!, {
    expiresIn: "7d",
  });

  res.json({ token });
}
