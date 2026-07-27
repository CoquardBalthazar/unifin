// import { useState, useEffect } from "react";
// import type { Transaction } from "../../types/types";
import { useNavigate } from "react-router-dom";
import { RecentTransactions } from "./RecentTransactions";

// type Props = {
//     transactions : Transaction[],
// }

export function DashboardPage() {
  const navigate = useNavigate();
  return (
    <>
      <h1>Dashboard</h1>
      <RecentTransactions />
      <button
        onClick={() => navigate("/transactions")}
        className="shrink-0 rounded-full px-2 py-1 text-white bg-primary hover:bg-primary-hover hover:text-white"
      >
        See all
      </button>
    </>
  );
}
