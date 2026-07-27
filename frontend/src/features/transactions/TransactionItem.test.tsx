import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TransactionItem } from "./TransactionItem";
import type { Transaction } from "../../types/types";

import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

describe("TransactionItem", () => {
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
      amount: -890.0,
      date: "2026-07-03",
      category: "Housing",
    },
  ];
  // Component test
  it("renders the transaction name and amount", () => {
    render(
      <TransactionItem transaction={transactions[0]} onDelete={() => {}} />,
    );
    expect(screen.getByText("Salary")).toBeInTheDocument();
    expect(screen.getByText("14.7.2026")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete Salary" }),
    ).toBeInTheDocument();
    const expected =
      "+" +
      new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
      }).format(1600);
    expect(
      screen.getByText((_, el) => el?.textContent === expected),
    ).toBeInTheDocument();
  });

  // Interaction Test
  it("calls onDelete when the delete button is clicked", async () => {
    const onDelete = vi.fn();
    render(
      <TransactionItem transaction={transactions[0]} onDelete={onDelete} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith("t1");
  });
});
