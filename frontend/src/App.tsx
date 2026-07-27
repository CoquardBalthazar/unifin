import "./App.css";
import { Routes, Route } from "react-router-dom";
import { NavBar } from "./core/NavBar";

import { DashboardPage } from "./features/dashboard/DashboardPage";
import { TransactionPage } from "./features/transactions/TransactionPage";

function App() {
  return (
    <>
      <div>
        <NavBar />
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/transactions" element={<TransactionPage />} />
        </Routes>
      </div>
    </>
  );
}

export default App;
