// backend/src/index.ts
import "dotenv/config";
import express from "express";
import { transactionsRouter } from "./routes/transactions.js";
import { authRouter } from "./routes/auth.js";
import { requireAuth } from "./middleware/auth.js";

import { fileURLToPath } from "node:url";

// -----
// Create the express app
// -----
export const app = express();

// ----- ADDING MIDDLEWARE TO EXPRESS APP obj -----
// `express.json()` is middleware — think of it as the decorator
// that runs before every request in this app, parsing the JSON
// body onto `req.body`.
// Forget it and every `POST` silently gives you `undefined`.
app.use(express.json());

// -----
// ADD Routers `requireAuth` passed as a second argument to `app.use`
// -----
app.use("/api/auth", authRouter); // public
app.use("/api/transactions", requireAuth, transactionsRouter); // protected — requireAuth runs first, then add the router
// applies it to every route inside `transactionsRouter` — you
// don't repeat it per-route. The `require.main === module` guard
// is what lets Supertest `import { app }` in 2a's tests without also
// binding a real port during test runs.

// // Run in Port if file ran as main file
// Python analog: this whole check is the JS/ESM equivalent of if __name__ == "__main__":.
const PORT = process.env.PORT || 4000;
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => console.log(`Backend listening on :${PORT}`));
}
