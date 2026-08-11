import { useState, useEffect } from "react";
import type { Transaction } from "../../types/types";
import { fetchTransactions } from "../../api/transactions";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Rectangle,
} from "recharts";

export function SummaryChart() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);

  //  Load recent transaction
  useEffect(() => {
    let ignore = false;

    fetchTransactions()
      .then((data) => {
        if (!ignore) {
          setTransactions(data);
        }
      })
      .catch(() => {
        if (!ignore) {
          setError("Could not load transactions");
        }
      });
    return () => {
      ignore = true;
    }; // cleanup
  }, []); // no dependencies

  //   Error handling
  if (error) return <p className="muted">{error}</p>;

  // Compute values
  const income = transactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  const expense = transactions
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + t.amount, 0);
  const net = income + expense;

  // Chart Source Data : Label, data, style
  const data = [
    { name: "Income", value: income, color: "var(--color-income)" },
    { name: "Expenses", value: expense, color: "var(--color-expense)" },
    { name: "Net", value: net, color: "var(--color-primary)" },
  ];

  return (
    <section>
      <h2 className="text-lg font-semibold text-ink mb-2">Summary</h2>
      <BarChart width={600} height={480} data={data}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--color-border)"
          vertical={false}
        />
        <XAxis
          dataKey="name"
          tick={{ fill: "var(--color-ink)", fontSize: 12 }}
        />
        <YAxis tick={{ fill: "var(--color-ink)", fontSize: 12 }} width={40} />
        <Bar
          dataKey="value"
          radius={[4, 4, 0, 0]}
          shape={(props) => <Rectangle {...props} fill={props.payload.color} />}
        ></Bar>
      </BarChart>
    </section>
  );
}
