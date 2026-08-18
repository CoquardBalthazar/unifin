import { Router } from "express";
import * as controller from "../controllers/health.js";

export const healthRouter = Router();
healthRouter.get("/", controller.health);
