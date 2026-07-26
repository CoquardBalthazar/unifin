export type Transaction = {
  id: string;
  label: string;
  amount: number; // income = positive, expense = negative
  date: string; // ISO
  category: string;
};

export type Filter = "all" | "expense" | "income";
