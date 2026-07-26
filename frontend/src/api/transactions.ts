import type { Transaction, Filter } from "../types/types.ts";

export const MOCK = [
  {
    id: "t1",
    label: "Salary",
    amount: 1600,
    date: "2026-07-14",
    category: "income",
  },
  {
    id: "t2",
    label: "Rent",
    amount: -890.0,
    date: "2026-07-03",
    category: "Housing",
  },
  {
    id: "t3",
    label: "Lidl",
    amount: -62.3,
    date: "2026-07-05",
    category: "Groceries",
  },
  {
    id: "t4",
    label: "Deutsche Bahn",
    amount: -193.2,
    date: "2026-07-09",
    category: "Transport",
  },
];

export function fetchTransactions(): Promise<Transaction[]> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < 0.2) {
        reject(new Error("Failed to fetch transactions"));
      } else {
        resolve(MOCK);
      }
    }, 800);
  });
}
