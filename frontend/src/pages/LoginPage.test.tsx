import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, it, describe, expect, beforeEach } from "vitest";
import { renderWithProviders } from "../test-utils";

import { LoginPage } from "./LoginPage";
import * as authApi from "../api/auth";

// Mock Fetch Call
vi.mock("../api/auth");

describe("LoginPage", () => {
  // Mock Login (POST fetching to get token from Backend)
  beforeEach(() => {
    vi.mocked(authApi.login).mockReset();
  });

  it("calls login with typed crendentials and navigates on success", async () => {
    // --- Arrange ---
    // Mock Success : return Token using "mockResolvedValue"
    vi.mocked(authApi.login).mockResolvedValue("fake-token");

    renderWithProviders(<LoginPage />);

    // --- Act ---
    await userEvent.type(screen.getByLabelText("Email"), "me@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "hunter2");

    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    // --- Assert ---
    expect(authApi.login).toHaveBeenCalledWith("me@example.com", "hunter2");
  });

  it("shows an error message on invalid credentials", async () => {
    // --- Arrange ---
    // Mock Failure : return Token using "mockResolvedValue"
    vi.mocked(authApi.login).mockRejectedValue(
      new Error("INVALID_CREDENTIALS"),
    );

    renderWithProviders(<LoginPage />);

    // --- Act ---
    await userEvent.type(screen.getByLabelText("Email"), "me@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");

    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    // --- Assert ---
    expect(
      await screen.findByText("Invalid email or password."),
    ).toBeInTheDocument();
  });
});
