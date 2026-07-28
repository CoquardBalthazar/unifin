import { db } from "../db/knex.js";

export type Transaction = {
  id: number;
  date: string;
  raw_name: string;
  amount: string; // Knex returns numeric columns as strings — cast at the edge, not here
  flow: "income" | "expense";
};

export function getAllTransactions(): Promise<Transaction[]> {
  return db("transactions").select("*").orderBy("date", "desc");
}

export function getTransactionById(
  id: number,
): Promise<Transaction | undefined> {
  return db("transactions").where({ id }).first();
}

export function createTransaction(input: {
  date: string;
  raw_name: string;
  amount: number;
  flow: "income" | "expense";
}): Promise<Transaction> {
  return db("transaction")
    .insert(input)
    .returning("*")
    .then((rows) => rows[0]);
}
