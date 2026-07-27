import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TransactionPage } from "./TransactionPage";
import { fetchTransactions } from "../../api/transactions";

vi.mock("../../api/transactions");

describe("TransactionPage", () => {
  beforeEach(() => {
    vi.mocked(fetchTransactions).mockReset();
  });

  const MOCK = [
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

  it("shows a loading state, then the fetched transactions", async () => {
    vi.mocked(fetchTransactions).mockResolvedValue(MOCK);
    render(<TransactionPage />);

    expect(screen.getByText("Loading transactions…")).toBeInTheDocument();
    expect(await screen.findByText("Salary")).toBeInTheDocument();
    expect(screen.getByText("Rent")).toBeInTheDocument();
  });

  it("shows an error message when the fetch fails", async () => {
    vi.mocked(fetchTransactions).mockRejectedValue(new Error("network down"));
    render(<TransactionPage />);

    expect(
      await screen.findByText("Could not load transactions"),
    ).toBeInTheDocument();
  });

  it("filters to income only when the Income filter is clicked", async () => {
    vi.mocked(fetchTransactions).mockResolvedValue(MOCK);
    render(<TransactionPage />);

    await screen.findByText("Salary");
    await userEvent.click(screen.getByRole("button", { name: "Income" }));

    expect(screen.getByText("Salary")).toBeInTheDocument();
    expect(screen.queryByText("Rent")).not.toBeInTheDocument();
  });

  it("filters to expenses only when the Expense filter is clicked", async () => {
    vi.mocked(fetchTransactions).mockResolvedValue(MOCK);
    render(<TransactionPage />);

    await screen.findByText("Salary");
    await userEvent.click(screen.getByRole("button", { name: "Expense" }));

    expect(screen.getByText("Rent")).toBeInTheDocument();
    expect(screen.queryByText("Salary")).not.toBeInTheDocument();
  });

  it("shows a message when the filter matches nothing", async () => {
    vi.mocked(fetchTransactions).mockResolvedValue([
      {
        id: "t1",
        label: "Salary",
        amount: 1600,
        date: "2026-07-14",
        category: "income",
      },
    ]);
    render(<TransactionPage />);

    await screen.findByText("Salary");
    await userEvent.click(screen.getByRole("button", { name: "Expense" }));

    expect(
      await screen.findByText("No Transactions match this filter"),
    ).toBeInTheDocument();
  });

  it("removes a transaction from the list when its delete button is clicked", async () => {
    vi.mocked(fetchTransactions).mockResolvedValue(MOCK);
    render(<TransactionPage />);

    await screen.findByText("Salary");
    await userEvent.click(screen.getByRole("button", { name: "Delete Rent" }));

    expect(screen.queryByText("Rent")).not.toBeInTheDocument();
    expect(screen.getByText("Salary")).toBeInTheDocument();
  });
});
