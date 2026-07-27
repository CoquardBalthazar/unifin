import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SummaryChart } from "./SummaryChart";
import { fetchTransactions } from "../../api/transactions";

vi.mock("../../api/transactions");

describe("SummaryChart", () => {
  it("renders axis labels for income, expenses, net", async () => {
    vi.mocked(fetchTransactions).mockResolvedValue([
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
    ]);
    render(<SummaryChart />);

    expect(await screen.findByText("Income")).toBeInTheDocument();
    expect(screen.getByText("Expenses")).toBeInTheDocument();
    expect(screen.getByText("Net")).toBeInTheDocument();
  });
});
