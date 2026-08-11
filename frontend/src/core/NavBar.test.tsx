import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";

// Test utils fro rendering
import { renderWithProviders } from "../test-utils";

import { NavBar } from "./NavBar";

describe("NavBar", () => {
  it("marks the current route as active", () => {
    renderWithProviders(<NavBar />, { route: "/transactions" });

    expect(screen.getByRole("link", { name: "Transactions" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
