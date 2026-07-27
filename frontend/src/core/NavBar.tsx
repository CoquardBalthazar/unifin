// src/core/NavBar.tsx
import { NavLink } from "react-router-dom";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? "font-bold underline text-white"
    : "opacity-70 text-white hover:opacity-100";

export function NavBar() {
  return (
    <nav className="flex gap-4 p-4 bg-slate-800">
      <NavLink to="/" end className={linkClass}>
        Home
      </NavLink>
      <NavLink to="/transactions" className={linkClass}>
        Transactions
      </NavLink>
    </nav>
  );
}
