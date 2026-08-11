import { useState, useEffect } from "react";
import type { Transaction } from "../../types/types";
import { TransactionList } from "../transactions/TransactionList";
import { fetchTransactions } from "../../api/transactions";

// Helpers
/**
 * Checks if a given date string falls within a specified number of days from today.
 *
 * @param dateStr - The date string to evaluate (e.g., "2026-07-25").
 * @param days - The number of days to look back from the current date.
 * @returns A boolean indicating if the date is within the range.
 *
 * @example
 * // Returns true if today is 2026-07-27
 * isWithinLastDays("2026-07-25", 7);
 */
function isWithinLastDays(dateStr: string, days: number): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return new Date(dateStr) >= cutoff;
}

// CONST
const RECENT_DAYS = 10;

export function RecentTransactions() {
  // useState
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  //  Load recent transaction
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

  if (isLoading) return <p className="muted">Loading…</p>;
  if (error) return <p className="muted">{error}</p>;

  const recents = transactions.filter((t) =>
    isWithinLastDays(t.date, RECENT_DAYS),
  );
  return (
    <section>
      <h2 className="text-lg font-semibold text-ink mb-2">
        Last {RECENT_DAYS} days
      </h2>
      {recents.length > 0 ? (
        <TransactionList transactions={recents} onDelete={() => {}} />
      ) : (
        <p className="muted">No transactions in the last {RECENT_DAYS} days.</p>
      )}
    </section>
  );
}
