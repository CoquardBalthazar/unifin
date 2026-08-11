import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthProvider";

// Mirrors main.tsx's provider nesting: AuthProvider OUTSIDE the router.
// If this drifts from production, tests pass while the app breaks.
export function renderWithProviders(ui: ReactNode, { route = "/" } = {}) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </AuthProvider>,
  );
}
