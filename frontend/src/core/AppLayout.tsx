import { Outlet } from "react-router-dom";
import { NavBar } from "./NavBar";

// ----- A layout route -----
// renders the persistent chrome, and <Outlet /> marks
// the hole the matched child route fills.
export function AppLayout() {
  return (
    <div className="flex min-h-screen">
      <NavBar />
      {/* flex-1 = take all remaining horizontal space next to the fixed sidebar */}
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
