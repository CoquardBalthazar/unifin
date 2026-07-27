import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { FilterBar } from "./FilterBar";

describe("FilterBar", () => {
  it("renders all three filter buttons", () => {
    render(<FilterBar active="all" onChange={() => {}} />);

    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Income" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Expense" }),
    ).toBeInTheDocument();
  });

  it("calls onChange with the clicked filter value", async () => {
    const onChange = vi.fn();
    render(<FilterBar active="all" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Income" }));

    expect(onChange).toHaveBeenCalledWith("income");
  });

  it("calls onChange even when clicking the already-active filter", async () => {
    // FilterBar has no active-filter guard — clicking "All" while already
    // active still fires onChange("all"). Documents current behavior.
    const onChange = vi.fn();
    render(<FilterBar active="all" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "All" }));

    expect(onChange).toHaveBeenCalledWith("all");
  });
});
