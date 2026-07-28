import "./App.css";
import { Routes, Route } from "react-router-dom";
import { NavBar } from "./core/NavBar";

import { LoginPage } from "./features/auth/LoginPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { TransactionPage } from "./features/transactions/TransactionPage";

function App() {
  return (
    <>
      <div>
        <NavBar />
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/transactions" element={<TransactionPage />} />
        </Routes>
      </div>
    </>
  );
}

export default App;
