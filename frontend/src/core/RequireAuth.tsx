import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

// ----- A "layout route" component -----
// it renders nothing of its own, it
// - either renders its matched child route (<Outlet/>)
// - or redirects.
export function RequireAuth() {
  const { isLoggedIn } = useAuth();

  // `replace`
  // swaps the current history entry instead of pushing a new one.
  // Without it, the browser Back button sends you to the protected URL you
  // were just bounced off — which immediately bounces you again. Back button
  // becomes useless.

  // `<Navigate>` is the component form of `useNavigate()`:
  // use the component when redirecting *during render*,
  // use the hook when redirecting *inside a handler* (as `LoginPage` does).
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
