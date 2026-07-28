/*
This is the req/res layer — it never constructs SQL.
If you ever swap Knex for something else, this file
doesn't change.
*/

import type { Request, Response } from "express";
import * as transactionsService from "../services/transactions.js";

export async function listTransactions(req: Request, res: Response) {
  const transactions = await transactionsService.getAllTransactions();
  res.json(transactions);
}

export async function getTransaction(req: Request, res: Response) {
  const id = Number(req.params.id);
  const transaction = await transactionsService.getTransactionById(id);

  if (!transaction) {
    return res.status(404).json({ error: "Transaction not found" });
  }
  res.json(transaction);
}

export async function createTransaction(req: Request, res: Response) {
  const { date, raw_name, amount, flow } = req.body;

  if (!date || !raw_name || amount === undefined || !flow) {
    return res
      .status(400)
      .json({ error: "date, raw_name, amount, flow are required" });
  }

  const created = await transactionsService.createTransaction({
    date,
    raw_name,
    amount,
    flow,
  });
  res.status(201).json(created);
}
