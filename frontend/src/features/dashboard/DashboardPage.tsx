// import { useState, useEffect } from "react";
// import type { Transaction } from "../../types/types";
// import { TransactionList } from "../transactions/TransactionList";
import { useNavigate } from "react-router-dom";

// type Props = {
//     transactions : Transaction[],
// }

export function DashboardPage() {
  const navigate = useNavigate();
  return (
    <>
      <h1>Dashboard</h1>
      <button
        onClick={() => navigate("/transactions")}
        className="shrink-0 rounded-full px-2 py-1 text-white bg-primary hover:bg-primary-hover hover:text-white"
      >
        Transactions
      </button>
    </>
  );
}
