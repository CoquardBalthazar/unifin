import { render, screen } from "@testing-library/react"; // DOM simulation
import { describe, it, expect, vi } from "vitest"; // testing in DOM
import userEvent from "@testing-library/user-event";
import { TransactionList } from "./TransactionList"; // // element to be tested
import type { Transaction } from "../../types/types";

describe("TransactionList", () => {
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
  it("renders one row per transaction", () => {
    render(<TransactionList transactions={transactions} onDelete={() => {}} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("renders no rows when the transaction list is empty", () => {
    render(<TransactionList transactions={[]} onDelete={() => {}} />);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("calls onDelete with the id of the clicked row", async () => {
    const onDelete = vi.fn();
    render(<TransactionList transactions={transactions} onDelete={onDelete} />);

    await userEvent.click(screen.getByRole("button", { name: "Delete Rent" }));

    expect(onDelete).toHaveBeenCalledWith("t2");
  });
});
