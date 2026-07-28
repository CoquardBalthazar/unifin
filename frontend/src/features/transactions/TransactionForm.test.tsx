import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, it, expect, describe } from "vitest";
import { TransactionForm } from "./TransactionForm";

describe("TransactionForm", () => {
  it("submits a filled-in transaction", async () => {
    const onAdd = vi.fn();
    render(<TransactionForm onAdd={onAdd} />);

    await userEvent.type(screen.getByPlaceholderText("Label"), "Coffee");
    await userEvent.type(screen.getByPlaceholderText("Amount"), "-3.5");
    await userEvent.type(screen.getByPlaceholderText("Category"), "Food");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "Coffee",
        amount: -3.5,
        category: "Food",
      }),
    );
  });
});
