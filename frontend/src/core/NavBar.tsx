// src/core/NavBar.tsx
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { LayoutDashboard, List, LogOut } from "lucide-react";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "flex items-center gap-3 rounded px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-primary-soft text-primary"
      : "text-ink-muted hover:bg-surface-alt hover:text-ink",
  ].join(" ");

export function NavBar() {
  const { markLoggedOut } = useAuth();
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface p-4">
      {/* Brand — alt="" because the word "Unifin" is right there;
          announcing the logo too would just repeat it. */}
      <Link
        to="/"
        className="flex items-center gap-2.5 rounded px-1 py-2 transition-colors hover:bg-surface-alt"
      >
        <img src="/mark-small.svg" alt="" className="size-7 rounded" />
        <span className="font-serif text-lg font-bold text-ink">Unifin</span>
      </Link>

      <nav className="mt-6 flex flex-col gap-1">
        <NavLink to="/" end className={linkClass}>
          <LayoutDashboard size={18} />
          Dashboard
        </NavLink>
        <NavLink to="/transactions" className={linkClass}>
          <List size={18} />
          Transactions
        </NavLink>
      </nav>

      {/* mt-auto = "shove me to the bottom" in a flex column.
          The one-class answer to sticky footers inside flex containers. */}
      <button
        onClick={markLoggedOut}
        className="mt-auto flex items-center gap-3 rounded px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-alt hover:text-ink"
      >
        <LogOut size={18} />
        Log out
      </button>
    </aside>
  );
}
