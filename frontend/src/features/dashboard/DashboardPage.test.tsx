// Testing specific to react
import { render, screen } from "@testing-library/react";
// Mock routing
import { MemoryRouter, Routes, Route } from "react-router-dom";
// Mock user interactions
import userEvent from "@testing-library/user-event";
// Testing methods
import { describe, it, expect, vi } from "vitest";

import { DashboardPage } from "./DashboardPage";
import { fetchTransactions } from "../../api/transactions";

vi.mock("../../api/transactions");

describe("DashboardPage", () => {
  it("navigates to /transactions when See all is clicked", async () => {
    vi.mocked(fetchTransactions).mockResolvedValue([]);

    // useNavigate needs an actual <Routes> tree to navigate between —
    // a bare MemoryRouter has nowhere to navigate TO, so we give it a
    // second dummy route and assert its content appears after the click.
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/transactions" element={<h1>Transactions</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("button", { name: /see all/i }));

    expect(
      await screen.findByRole("heading", { name: "Transactions" }),
    ).toBeInTheDocument();
  });

  it("renders the Dashboard heading and its child sections", async () => {
    vi.mocked(fetchTransactions).mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/"]}>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(await screen.findByText("Last 10 days")).toBeInTheDocument();
    expect(screen.getByText("Summary")).toBeInTheDocument();
  });
});
