import { render, screen } from "@testing-library/react";
import { describe, test, expect, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../context/AuthProvider";
import { RequireAuth } from "./RequireAuth";

// MemoryRouter instead of BrowserRouter: keeps history in memory, and
// `initialEntries` lets a test start on any URL without touching jsdom's
// address bar. The standard router-testing tool.
function renderAt(path: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<p>login page</p>} />
          <Route element={<RequireAuth />}>
            <Route path="/transactions" element={<p>secret transactions</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

// Remove any token stored
beforeEach(() => localStorage.clear());

describe("RequireAuth", () => {
  test("redirects to /login when no token", () => {
    renderAt("/transactions");
    expect(screen.getByText("login page")).toBeInTheDocument();
  });

  test("renders the protected route when a token exists", () => {
    localStorage.setItem("token", "fake.jwt.token"); // AuthProvider reads this on mount
    renderAt("/transactions");
    expect(screen.getByText("secret transactions")).toBeInTheDocument();
  });
});
