import { useState } from "react";

// Same useState pattern as TransactionsPage — one hook, one piece of
// state (isLoggedIn), reused everywhere auth status matters.
export function useAuth() {
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

  return { isLoggedIn, markLoggedIn, markLoggedOut };
}
