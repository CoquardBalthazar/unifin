import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock an async API module via vi.mock
import { fetchTransactions } from "../../api/transactions";

import { RecentTransactions } from "./RecentTransactions";

// The component compares against new Date(), so fixtures must be relative
// to today. A hardcoded date silently expires and fails weeks later.
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

// Mock API locations
vi.mock("../../api/transactions");

describe("RecentTransactions", () => {
  beforeEach(() => {
    // Reinit mockfunction
    vi.mocked(fetchTransactions).mockReset();
  });

  it("shows recent transactions once loaded", async () => {
    // Mock value from a simulated answer from API
    vi.mocked(fetchTransactions).mockResolvedValue([
      {
        id: "t1",
        label: "Salary",
        amount: 1600,
        date: daysAgo(1),
        category: "income",
      },
    ]);
    render(<RecentTransactions />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(await screen.findByText("Salary")).toBeInTheDocument();
  });

  it("shows a message when nothing is recent", async () => {
    vi.mocked(fetchTransactions).mockResolvedValue([
      {
        id: "t1",
        label: "Old rent",
        amount: -890,
        date: daysAgo(400),
        category: "Housing",
      },
    ]);

    render(<RecentTransactions />);

    expect(
      await screen.findByText("No transactions in the last 10 days."),
    ).toBeInTheDocument();
  });

  it("shows an error message when the fetch fails", async () => {
    vi.mocked(fetchTransactions).mockRejectedValue(new Error("network down"));
    render(<RecentTransactions />);

    expect(
      await screen.findByText("Could not load transactions"),
    ).toBeInTheDocument();
  });
});
