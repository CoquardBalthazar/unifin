import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock the router
import { MemoryRouter } from "react-router-dom";

import { NavBar } from "./NavBar";

describe("NavBar", () => {
  it("marks the current route as active", () => {
    render(
      <MemoryRouter initialEntries={["/transactions"]}>
        <NavBar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Transactions" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
