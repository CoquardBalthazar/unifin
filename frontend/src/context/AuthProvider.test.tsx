import { render, screen } from "@testing-library/react";
import { describe, test, expect } from "vitest";
import userEvent from "@testing-library/user-event";
import { AuthProvider } from "./AuthProvider";
import { useAuth } from "../hooks/useAuth";

function Reader() {
  const { isLoggedIn } = useAuth();
  return <span>{isLoggedIn ? "in" : "out"}</span>;
}

function Toggler() {
  const { markLoggedIn } = useAuth();
  return <button onClick={markLoggedIn}>log in</button>;
}

describe("AuthProvider", () => {
  test("state set by one consumer is visible to another", async () => {
    // 2 different Components read the same state.
    // If this is not the case (Reader and Toggler owns their own state independently),
    // the reader will not appear as Logged in after the UserEvent that logs in.
    render(
      <AuthProvider>
        <Reader />
        <Toggler />
      </AuthProvider>,
    );

    expect(screen.getByText("out")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    expect(screen.getByText("in")).toBeInTheDocument(); // ← fails against the 2b hook
  });
});
