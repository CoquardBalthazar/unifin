import { Router } from "express";
import * as controller from "../controllers/transactions.js";

// Express router ≈ Flask Blueprint: a mountable group of routes
export const transactionsRouter = Router();

transactionsRouter.get("/", controller.listTransactions);
transactionsRouter.get("/:id", controller.getTransaction);
transactionsRouter.post("/", controller.createTransaction);
