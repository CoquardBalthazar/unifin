import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SummaryBar } from "./SummaryBar";
import type { Transaction } from "../../types/types";

function formatEUR(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

describe("SummaryBar", () => {
  const transactions: Transaction[] = [
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
      amount: -890,
      date: "2026-07-03",
      category: "Housing",
    },
  ];

  it("renders income, expenses and a positive net total", () => {
    render(<SummaryBar transactions={transactions} />);

    // income
    expect(
      screen.getByText((_, el) => el?.textContent === formatEUR(1600)),
    ).toBeInTheDocument();
    // expenses
    expect(
      screen.getByText((_, el) => el?.textContent === formatEUR(890)),
    ).toBeInTheDocument();
    // Net
    expect(
      screen.getByText((_, el) => el?.textContent === "+" + formatEUR(710)),
    ).toBeInTheDocument();
  });

  it("renders a negative net total without a leading plus sign", () => {
    const heavyExpenses: Transaction[] = [
      {
        id: "t1",
        label: "Salary",
        amount: 500,
        date: "2026-07-14",
        category: "income",
      },
      {
        id: "t2",
        label: "Rent",
        amount: -890,
        date: "2026-07-03",
        category: "Housing",
      },
    ];

    render(<SummaryBar transactions={heavyExpenses} />);

    expect(
      screen.getByText((_, el) => el?.textContent === formatEUR(-390)),
    ).toBeInTheDocument();
  });

  it("renders zeros when there are no transactions", () => {
    render(<SummaryBar transactions={[]} />);

    expect(
      screen.getAllByText((_, el) => el?.textContent === formatEUR(0)).length,
    ).toBeGreaterThan(0);
  });
});
