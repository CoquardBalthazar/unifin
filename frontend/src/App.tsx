import "./App.css";
import { Routes, Route } from "react-router-dom";
import { RequireAuth } from "./core/RequireAuth";
import { AppLayout } from "./core/AppLayout";

import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { TransactionPage } from "./features/transactions/TransactionPage";

function App() {
  return (
    <Routes>
      {/* public  — no sidebar, no guard  */}
      <Route path="/login" element={<LoginPage />} />

      {/* protected — guard → layout → page */}
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/transactions" element={<TransactionPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
