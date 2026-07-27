import { useState, useEffect } from "react";
import type { Transaction, Filter } from "../../types/types";
import { TransactionList } from "./TransactionList";
import { FilterBar } from "./FilterBar";
import { SummaryBar } from "./SummaryBar";
import { fetchTransactions } from "../../api/transactions";

export function TransactionPage() {
  // useState
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

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

  function handleFilterChange(next: Filter) {
    setFilter(next);
  }

  //  --- Filtering : derived value array ---
  //  Visible Transaction = Compute a derived array called visible —
  // not stored in state, just a plain const computed on every render
  // from transactions.filter(...):
  const visible = transactions.filter((t) => {
    if (filter === "income") {
      return t.amount > 0;
    }
    if (filter === "expense") {
      return t.amount < 0;
    }
    return true;
  });
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
      <FilterBar active={filter} onChange={handleFilterChange} />
      <SummaryBar transactions={visible} />
      {visible.length > 0 ? (
        <TransactionList
          transactions={visible}
          onDelete={handleDelete}
        ></TransactionList>
      ) : (
        <p className="muted">No Transactions match this filter</p>
      )}
    </main>
  );
}
