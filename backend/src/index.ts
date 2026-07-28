// backend/src/index.ts
import "dotenv/config";
import express from "express";
import { transactionsRouter } from "./routes/transactions.js";

import { fileURLToPath } from "node:url";

// Create the express app
export const app = express();
// `express.json()` is middleware — think of it as the decorator
// that runs before every request in this app, parsing the JSON
// body onto `req.body`.
// Forget it and every `POST` silently gives you `undefined`.
app.use(express.json());

app.use("/api/transactions", transactionsRouter);

const PORT = process.env.PORT || 4000;
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => console.log(`Backend listening on :${PORT}`));
}
