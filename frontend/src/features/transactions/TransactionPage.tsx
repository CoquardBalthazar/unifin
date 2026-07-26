import { useState, useEffect } from "react";
import type { Transaction } from "../../types/types";
import { TransactionList } from "./TransactionList";
import { fetchTransactions } from "../../api/transactions";

export function TransactionPage() {
  // useState
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  //   useEffect
  // run after the first re-render.
  // [] : no dependencies = never re-runs
  // cleanup : ignore flag
  // unmounted component mid-fetch : no setState
  useEffect(() => {
    let ignore = false;

    fetchTransactions()
      .then((data) => {
        if (!ignore) {
          setTransactions(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!ignore) {
          setError("Could not load transactions");
          setIsLoading(false);
        }
      });
    return () => {
      ignore = true;
    }; // cleanup
  }, []); // no dependencies

  //   Callback passed down to children
  function handleDelete(id: string) {
    setTransactions((current) => current.filter((t) => t.id !== id));
  }

  //   Conditional rendering : early returns
  // Handle isLoading vs error
  if (isLoading) {
    return <p className="muted">Loading transactions…</p>;
  }
  if (error) {
    return <p className="error">{error}</p>;
  }

  return (
    <main>
      <h1>Unifin - Transaction</h1>
      <TransactionList
        transactions={transactions}
        onDelete={handleDelete}
      ></TransactionList>
    </main>
  );
}
