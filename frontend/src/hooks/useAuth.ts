import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

// No state here - comes from the context
// This hook is a thin typed reader of the single state owned by AuthProvider
export function useAuth() {
  const value = useContext(AuthContext);

  //  Guard : avoid and fail loudly if reading the context outside <AuthProvider>, which
  // returns the `null` default.
  if (!value) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }

  return value;
}
