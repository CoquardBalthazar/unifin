// components only, so Fast Refresh works
import { useState, type ReactNode } from "react";
import { AuthContext } from "./AuthContext";

// PROVIDER component OWNS the state
// This is the only useState for auth in the whole app
export function AuthProvider({ children }: { children: ReactNode }) {
  // Lazy initialiser : State read once, on first render only
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => !!localStorage.getItem("token"),
  );

  function markLoggedIn() {
    setIsLoggedIn(true);
  }
  function markLoggedOut() {
    localStorage.removeItem("token");
    setIsLoggedIn(false);
  }

  return (
    <AuthContext value={{ isLoggedIn, markLoggedIn, markLoggedOut }}>
      {children}
    </AuthContext>
  );
}
