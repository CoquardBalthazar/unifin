import { createContext } from "react";

// The shape every consumer gets back. Exported so useAuth can type its return.
export type AuthValue = {
  isLoggedIn: boolean;
  markLoggedIn: () => void;
  markLoggedOut: () => void;
};

export const AuthContext = createContext<AuthValue | null>(null);
