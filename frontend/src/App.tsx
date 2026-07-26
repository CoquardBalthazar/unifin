import "./App.css";

import { TransactionPage } from "./features/transactions/TransactionPage";

function App() {
  return (
    <>
      <div>
        <h1>Unifin</h1>
        <p>See below the list of transactions</p>
        <TransactionPage />
      </div>
    </>
  );
}

export default App;
