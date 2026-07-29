import { Router } from "express";
import * as controller from "../controllers/auth.js";

export const authRouter = Router();
authRouter.post("/login", controller.login);
