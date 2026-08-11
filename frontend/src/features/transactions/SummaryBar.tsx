import type { Transaction } from "../../types/types";
import { useMemo } from "react";

type Props = {
  transactions: Transaction[];
};

export function SummaryBar({ transactions }: Props) {
  // Cache the result using useMemo
  // Wrap the function inside the useMemo
  // functions return 3 values directly in the consts variables; similar to tuple unpacking

  const { income, expenses, net } = useMemo(() => {
    const income = transactions
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    const expenses = transactions
      .filter((t) => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return { income, expenses, net: income - expenses };
  }, [transactions]); // dependency array : each change call the functions, no change computed is cached

  return (
    <div className="summary-bar">
      <span>
        In <strong>{formatEUR(income)}</strong>
      </span>
      <span>
        Out <strong>{formatEUR(expenses)}</strong>
      </span>
      <span className={net >= 0 ? "positive" : "negative"}>
        Net{" "}
        <strong>
          {net >= 0 ? "+" : ""}
          {formatEUR(net)}
        </strong>
      </span>
    </div>
  );

  function formatEUR(value: number) {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  }
}
