# Unifin — Bank Tracker · Development Plan

> Working document. Living plan for `unifin` (Unifin).
> Created: 2026-06-22. Last updated: 2026-06-24.

---

## 1. Context & strategy

Unifin is the **second rung of a 3-project learning ladder**:

| Project | Role in the ladder | Stack |
|---|---|---|
| **Portfolio** (`coquardbalthazar.github.io`) | Done. Learned Vite + React + TS + GitHub Actions → GH Pages. | React + Vite + TS |
| **Unifin** (this repo) | Step up. Same frontend + first real backend: Express + PostgreSQL + JWT + Docker. Personal use → solo auth. | React + Vite + TS + Node/Express + PostgreSQL + Docker |
| **CREA** | Main project. Multi-user, groups, chat, AI coach. Forks this repo's skeleton. | Full-stack (same, + realtime) |

**Build order:** Bank Tracker v0 → ships → (apply for SE Werkstudent roles) → CREA v0 (rewired manually from what was learned here, no automated template extraction) → continue applying with stronger profile.

Unifin is **not** the portfolio centrepiece — CREA is. Unifin is a working personal tool that also produces a battle-tested skeleton for CREA.

### What Unifin does

- **Extract:** import transaction files from La Banque Postale (TSV), C24 Bank (CSV), future sources (PayPal, Trade Republic, PSD2 open banking).
- **Transform:** normalize to a common schema, auto-categorize via a rules dictionary, flag unknowns for manual review.
- **Store:** PostgreSQL — raw → clean data flow, full traceability.
- **App:** review + categorize transactions on desktop and mobile, yearly overview with per-category totals.

### Banking data privacy

Real transaction files are **never committed.** The repo is public and portfolio-safe:
- `data/real/` gitignored entirely.
- `data/sample/` holds synthetic fixture data (fake names, rounded amounts) — committed, used by CI.
- Both `.env` files gitignored; `.env.example` files committed with placeholders.
- CI runs against sample data only — no real transactions ever in Actions logs.

---

## 2. Stack — locked

| Layer | Choice | Reason |
|---|---|---|
| Frontend | React + Vite + TypeScript | Matches portfolio + CREA exactly |
| Styling | **Tailwind CSS** | New project, no existing design system, industry standard, faster to build |
| Backend | Node.js + Express + TypeScript | Same as CREA |
| Database | PostgreSQL | Same as CREA; real SQL |
| Migrations | **Knex.js** | Lightweight, raw-SQL-friendly, migration pattern ≈ Alembic in Python |
| Auth | JWT, single user | Credentials in `backend/.env`; no registration; same pattern CREA will extend |
| ETL (v0) | Python scripts, run manually from terminal | Already works, zero new overhead, unblocks Phase 2 immediately |
| ETL (v1, Phase 5) | Node `child_process` spawns Python | Enables file import from phone UI |
| Dev environment | Docker Compose (app + postgres) | Same as CREA |
| CI/CD | GitHub Actions | Same pipeline as CREA |
| Deploy: backend + DB | **Railway** | $5 free credit/month covers a small app; DB doesn't pause; better DX than Render |
| Deploy: frontend | **Vercel** | Zero-config Vite, auto preview URLs per PR, clean env var handling |
| `.env` | **Separate** `backend/.env` + `frontend/.env` | Backend secrets never bleed into frontend |

---

## 3. Data schema

Four tables. Designed once, never changed without a migration file.

```
accounts        — id, bank, account_type, currency, label
transactions    — id, account_id, date, raw_name, amount, flow, category_id (nullable), source_file, imported_at
categories      — id, label, type (income/expense/transfer), visible
category_rules  — id, pattern, category_id, priority
```

**The rules loop:** on import, `raw_name` matched against `category_rules` (substring, ordered by priority). Match → `category_id` set. No match → `NULL` (shown as "uncategorized", flagged for review). Manual override in UI → optionally writes new rule → next import auto-categorizes it.

**Categories** seeded from existing `FOLGUNG_der_Kontos_WIP.xlsx` taxonomy:
FOOD & Households, HOUSING rent, TRANSPORT, HOBBIES, HEALTH, TRIPS, SAVINGS, STUDIES, PHONE bundle, PARTIES & Sorties, OTHERS-inflow, OTHERS-outflow, ARBEIT, internal transfers (BALU), scholarships (BRMI, CROUS, Erasmus+), etc.

---

## 4. Repo structure (target)

```
unifin/
├── backend/
│   ├── src/
│   │   ├── routes/         # URL + method → controller
│   │   ├── controllers/    # req/res, input validation
│   │   ├── services/       # business logic, DB queries — no req/res
│   │   ├── db/
│   │   │   ├── knex.ts     # Knex instance
│   │   │   └── migrations/ # append-only, one file per change
│   │   ├── middleware/     # auth.ts, error.ts
│   │   └── index.ts
│   ├── etl/                # bp.py, c24.py, combine_bank_data.py, db_insert.py
│   ├── .env                # ❌ gitignored
│   ├── .env.example        # ✅ committed
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # reusable pieces (TransactionRow, CategoryDropdown, NavBar…)
│   │   ├── pages/          # full screens (TransactionsPage, OverviewPage, ImportPage, LoginPage)
│   │   ├── api/            # typed fetch wrappers
│   │   ├── hooks/          # useAuth, useIsMobile, useTransactions…
│   │   └── main.tsx
│   ├── .env                # ❌ gitignored
│   ├── .env.example        # ✅ committed
│   └── vite.config.ts
├── data/
│   ├── sample/             # ✅ committed — synthetic fixtures
│   │   ├── sample_bp.tsv
│   │   └── sample_c24.csv
│   └── real/               # ❌ gitignored
├── docker-compose.yml
├── .gitignore
├── .github/workflows/ci.yml
├── CLAUDE.md
├── CLAUDE.local.md         # ❌ gitignored
└── PLAN_unifin.md
```

---

## 5. Phased plan

Each phase is tagged with the layer(s) it touches, the tech stack in play, and a rough time estimate. Commands are run by hand (per project conventions) — no assistant-driven scaffolding.

### Phase 1 — React fundamentals sprint
**Layer:** Frontend · **Stack:** React, Vite, TypeScript, React Router, Vitest, React Testing Library · **Estimate:** 1 day

*Not a throwaway tutorial — this builds unifin's real frontend shell in place.*

- [ ] `npm create vite@latest` (React + TS) — run and confirmed by you, inside the real `frontend/` folder from the repo structure (section 4), not a separate practice folder
- [ ] Skim React docs "Describing the UI" + "Adding Interactivity" — scan headers only: `useState`, `useEffect`, props/children
- [ ] Build the 3-component skeleton:
  - [ ] `<TransactionList>` — props, list rendering, `key` management
  - [ ] `<TransactionForm>` — controlled inputs, `useState`
  - [ ] `<Dashboard>` — composes both, lifts state up
- [ ] `useTransactions()` custom hook — stub returning mock data (placeholder for the real API call in Phase 5)
- [ ] React Router: `/`, `/transactions`, `/login` (empty page, wired up in Phase 2) — this is unifin's real route structure
- [ ] Vitest + React Testing Library: 3–4 tests — renders list, form submit updates state, routing navigates. Pattern over coverage.

**Learning outcome:** components, props vs state, custom hooks, routing, render → interact → assert testing pattern.

### Phase 1b — Testing sprint: Vitest + React Testing Library (components) + Cypress (navigation/e2e)

**Layer:** Frontend · **Stack:** Vitest, React Testing Library, jsdom, Cypress · **Estimate:** half day

Industry-standard split for this stack: **Vitest + RTL** for unit/component tests (fast, no browser, run in CI on every push), **Cypress** for real end-to-end navigation tests (actual browser, actual URL bar, actual clicks) — RTL never actually changes the URL, so router *behavior* (not just "did navigate() get called") needs Cypress.

---

#### Step 1 — Install Vitest + React Testing Library

```bash
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- `vitest` — test runner, Vite-native, near-zero config since you're already on Vite.
- `jsdom` — fake browser DOM so tests can run in Node without a real browser.
- `@testing-library/react` — renders components into that fake DOM and gives you `screen.getByText()` etc.
- `@testing-library/jest-dom` — adds matchers like `.toBeInTheDocument()`.
- `@testing-library/user-event` — simulates real clicks/typing (more realistic than `fireEvent`).

Add to `vite.config.ts`:
```ts
/// <reference types="vitest/config" />
export default defineConfig({
  // ...existing config
  test: {
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
  },
});
```

Create `src/setupTests.ts`:
```ts
import "@testing-library/jest-dom";
```

Add to `package.json` scripts: `"test": "vitest"`.

Stop here, run `npm run test` — it should say "No test files found" (that's success, means the runner works).

---

#### Step 2 — First component test: `TransactionItem`

Python analogy: this is `pytest` — `render()` ≈ setting up the object under test, `screen.getBy...` ≈ your assertions, except you're asserting against rendered DOM output instead of a return value.

Create `src/features/transactions/TransactionItem.test.tsx` next to the component:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TransactionItem } from "./TransactionItem";

describe("TransactionItem", () => {
  it("renders the transaction name and amount", () => {
    render(
      <TransactionItem
        transaction={{ id: 1, raw_name: "REWE", amount: -23.5, date: "2026-07-01" }}
        onDelete={() => {}}
      />
    );

    expect(screen.getByText("REWE")).toBeInTheDocument();
    expect(screen.getByText(/23.5/)).toBeInTheDocument();
  });
});
```

Adjust the prop shape to match your actual `TransactionItem` props — check the file before writing this. Run `npm run test`, confirm it's green.

---

#### Step 3 — Interaction test: delete callback fires

```tsx
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

it("calls onDelete when the delete button is clicked", async () => {
  const onDelete = vi.fn();
  render(<TransactionItem transaction={{ id: 1, raw_name: "REWE", amount: -23.5, date: "2026-07-01" }} onDelete={onDelete} />);

  await userEvent.click(screen.getByRole("button", { name: /delete/i }));

  expect(onDelete).toHaveBeenCalledWith(1);
});
```

`vi.fn()` ≈ `unittest.mock.Mock()` — a fake function you can assert was called, with what args.

---

#### Step 4 — List test: `TransactionList` renders N items and filters

```tsx
it("renders one row per transaction", () => {
  const transactions = [
    { id: 1, raw_name: "REWE", amount: -23.5, date: "2026-07-01" },
    { id: 2, raw_name: "Salary", amount: 2000, date: "2026-07-01" },
  ];
  render(<TransactionList transactions={transactions} onDelete={() => {}} />);

  expect(screen.getAllByRole("listitem")).toHaveLength(2);
});
```

This only works if `TransactionList` renders real `<li>`/`role="listitem"` elements — if it's `<div>`s, either add semantic HTML (recommended, also helps accessibility) or query by `data-testid` instead.

---

#### Step 4b — Extended component tests (do manually, new concepts per component)

Components already testable with concepts covered so far (`render`, `screen.getByText`/`getByRole`, `userEvent`, `vi.fn`): `FilterBar`, `SummaryBar` — pure, no router, no async state.

Remaining components each introduce a *new* testing concept — tackle one at a time, in this order:

**1. `NavBar` — testing React Router components in isolation**

`NavLink`/`useNavigate` throw at render time outside a router context, so wrap the component under test in `<MemoryRouter>` (a Router that lives entirely in memory — no real browser URL, for tests only). Assert on the active route via `aria-current="page"`, which React Router sets automatically on the active `NavLink` — more robust than string-matching your `linkClass` className.

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { NavBar } from "./NavBar";

describe("NavBar", () => {
  it("marks the current route as active", () => {
    render(
      <MemoryRouter initialEntries={["/transactions"]}>
        <NavBar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Transactions" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
```

`initialEntries` seeds the in-memory history stack — this is how you simulate "the user is currently on `/transactions`" without a real browser URL.

**2. `RecentTransactions`, `SummaryChart`, `TransactionPage` — mocking an async API module with `vi.mock`**

All three call `fetchTransactions()`, which has a real `setTimeout` and a random 20% rejection — untestable as-is (flaky, slow). `vi.mock(...)` replaces the whole module with a mock at import time; `vi.mocked(fetchTransactions)` then gives you a typed handle to control what it resolves/rejects with per test.

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RecentTransactions } from "./RecentTransactions";
import { fetchTransactions } from "../../api/transactions";

vi.mock("../../api/transactions");

describe("RecentTransactions", () => {
  beforeEach(() => {
    vi.mocked(fetchTransactions).mockReset();
  });

  it("shows recent transactions once loaded", async () => {
    vi.mocked(fetchTransactions).mockResolvedValue([
      { id: "t1", label: "Salary", amount: 1600, date: "2026-07-26", category: "income" },
    ]);

    render(<RecentTransactions />);

    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(await screen.findByText("Salary")).toBeInTheDocument();
  });

  it("shows a message when nothing is recent", async () => {
    vi.mocked(fetchTransactions).mockResolvedValue([
      { id: "t1", label: "Old rent", amount: -890, date: "2020-01-01", category: "Housing" },
    ]);

    render(<RecentTransactions />);

    expect(
      await screen.findByText("No transactions in the last 10 days."),
    ).toBeInTheDocument();
  });
});
```

New syntax here: `findByText` is the **async** counterpart to `getByText` — it returns a `Promise` and retries for up to ~1s until a matching element appears (or throws). Use it whenever the assertion targets something that only appears *after* an effect/fetch resolves; `getByText` is synchronous and would run before the `useEffect` promise settles. `beforeEach` + `mockReset()` stops mock behavior from leaking between tests in the same file.

**3. `SummaryChart` — testing chart libraries (Recharts)**

Recharts measures its container via `ResizeObserver`/SVG layout APIs jsdom doesn't implement, so it often renders zero-size. Don't assert on pixels/bar geometry — assert only on the data your component computed and handed to the chart (that's your logic; how Recharts draws it is not your code's job to verify).

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SummaryChart } from "./SummaryChart";
import { fetchTransactions } from "../../api/transactions";

vi.mock("../../api/transactions");

describe("SummaryChart", () => {
  it("renders axis labels for income, expenses, net", async () => {
    vi.mocked(fetchTransactions).mockResolvedValue([
      { id: "t1", label: "Salary", amount: 1600, date: "2026-07-14", category: "income" },
      { id: "t2", label: "Rent", amount: -890, date: "2026-07-03", category: "Housing" },
    ]);

    render(<SummaryChart />);

    expect(await screen.findByText("Income")).toBeInTheDocument();
    expect(screen.getByText("Expenses")).toBeInTheDocument();
    expect(screen.getByText("Net")).toBeInTheDocument();
  });
});
```

If this still fails with layout-related jsdom errors, add a `ResizeObserver` stub to `setupTests.ts`:
```ts
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
```

**4. `DashboardPage` — combines #1 and #2**

Needs both `MemoryRouter` (for `useNavigate`/the "See all" button) and the `fetchTransactions` mock (since it renders `RecentTransactions` + `SummaryChart`, both of which fetch). Do this one last, once 1–3 are solid — it's the union of everything above, not a new concept:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { DashboardPage } from "./DashboardPage";
import { fetchTransactions } from "../../api/transactions";

vi.mock("../../api/transactions");

describe("DashboardPage", () => {
  it("navigates to /transactions when See all is clicked", async () => {
    vi.mocked(fetchTransactions).mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/"]}>
        <DashboardPage />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("button", { name: /see all/i }));
    // MemoryRouter has no visible URL bar — assert via a route change effect,
    // e.g. render <Routes> in the test and check the resulting screen content,
    // or spy on useNavigate with vi.mock("react-router-dom", ...).
  });
});
```

Note the last test is intentionally left open-ended — asserting "did navigation happen" inside a bare `MemoryRouter` (no `<Routes>` around it) needs either a full `<Routes>` test harness or mocking `useNavigate` itself; work out which approach once you're there, it's a good exercise.

---

#### Step 5 — Install Cypress for navigation/e2e

```bash
npm install -D cypress
npx cypress open
```

`cypress open` launches an interactive browser the first time — it'll scaffold `cypress.config.ts` and a `cypress/e2e/` folder for you. Pick "E2E Testing" → your browser of choice. This is a real browser driving your real running app, not a simulation — closer to how you'd manually click through it.

Add to `package.json` scripts: `"cypress": "cypress open"`, `"cypress:run": "cypress run"`.

Point it at your dev server in `cypress.config.ts`:
```ts
import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:5173",
  },
});
```

Stop here — confirm the Cypress app window opens and can see your project.

---

#### Step 6 — Navigation e2e test

Dev server must be running (`npm run dev`) in a separate terminal for this.

Create `cypress/e2e/navigation.cy.ts`:
```ts
describe("Navigation", () => {
  it("navigates from Dashboard to Transactions and back", () => {
    cy.visit("/");
    cy.contains("h1", /dashboard/i); // adjust to your actual heading text

    cy.contains("button", "Transactions").click();
    cy.url().should("include", "/transactions");
    cy.contains("h1", /transactions/i);

    cy.contains("button", "Home").click();
    cy.url().should("eq", "http://localhost:5173/");
  });

  it("navigates to /transactions via the See all button on the dashboard", () => {
    cy.visit("/");
    cy.contains("button", /see all/i).click();
    cy.url().should("include", "/transactions");
  });
});
```

Run via `npx cypress run` (headless, CI-friendly) or `npx cypress open` (interactive, watch it click through the real browser).

---

**Learning outcome:** the RTL vs Cypress split — RTL for fast, isolated component behavior (runs in every CI push, no browser needed); Cypress for real user-facing flows across the whole app (slower, browser-based, run less often or pre-merge). This is the same split CREA will use.

### Phase 2 — Express backend + auth sprint
**Layer:** Backend · **Stack:** Node, Express, TypeScript, ts-node-dev, PostgreSQL, JWT, bcrypt, Supertest, Vitest · **Estimate:** 1 day (weekend)

*Same principle — real `backend/` folder, not a throwaway API.*

- [ ] `npm init`, Express + TypeScript, `ts-node-dev` — inside `backend/`
- [ ] Skim Express routing guide — 10 min, no more
- [ ] REST endpoints against Postgres: `GET/POST /api/transactions`, `GET /api/transactions/:id`
- [ ] DB access via **Knex** (locked in section 2 — not Prisma; keep the ORM choice consistent from the first line of code so nothing needs porting later)
- [ ] Supertest + Vitest: one test per route (200 valid, 400/404 bad input)
- [ ] Auth exercise — the one place to follow a focused guide, since JWT has easy-to-miss security details:
  - [ ] `POST /api/auth/login` (bcrypt hash check, JWT issue) — single hardcoded user from `backend/.env`, no registration endpoint (per section 2)
  - [ ] Middleware protecting `/api/transactions` routes
  - [ ] Frontend: login form → store token → attach to fetch calls → redirect on 401 (wires into the `/login` route from Phase 1)

**Learning outcome:** Express routing, Knex query basics, JWT auth end-to-end, protected routes, wiring frontend auth to a real API.

### Phase 3 — Skeleton hardening
**Layer:** Full-stack · **Stack:** Docker Compose, Knex migrations, GitHub Actions · **Estimate:** half day

*Wraps Phases 1–2 into the repo's real infrastructure — this is the CREA skeleton.*

- [ ] Create repo `unifin` on GitHub (start private, make public once gitignore confirmed)
- [ ] `.gitignore` — first thing written: `data/real/`, `backend/.env`, `frontend/.env`, `CLAUDE.local.md`
- [ ] `docker-compose.yml` — two services: `app` (Node) + `postgres`
- [ ] Knex setup: `knex.ts` config, first migration (`accounts` table), `npm run migrate`
- [ ] `GET /health` route, confirmed reachable through Docker
- [ ] Tailwind setup on the frontend, proxy → backend
- [ ] Auth context / `useAuth` hook, protected route wrapper (formalizes the Phase 2 login flow)
- [ ] GitHub Actions CI: lint + build on push
- [ ] Confirm full loop: login → protected page → `GET /health` with token → 200

**Learning outcome:** Docker Compose, Knex migrations end-to-end, CI basics — the parts CREA will fork.

### Phase 4 — Database schema + ETL
**Layer:** Backend · **Stack:** Knex migrations, PostgreSQL, Python (existing ETL) · **Estimate:** half day

*Migrations for the remaining tables. Python ETL writes to Postgres.*

- [ ] Migrations: `transactions`, `categories`, `category_rules`
- [ ] Seed script: populate `categories` from existing taxonomy, using `data/sample/`
- [ ] Extend Python ETL: `db_insert.py` writes normalized rows to `transactions` (instead of CSV)
- [ ] `backend/.env.example`: `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`
- [ ] Verify: run `db_insert.py` with sample fixture → check row count + dates + amounts in DB

**Learning outcome:** full Knex migration workflow, seeding, Python writing directly to Postgres.

### Phase 5 — Transactions UI
**Layer:** Full-stack · **Stack:** Express (PATCH routes), Knex, React (controlled inputs) · **Estimate:** 1 day

*The core editing loop — this is where the app becomes useful.*

- [ ] `GET /transactions` — paginated, filterable by account / date range / flow / category
- [ ] `TransactionsPage`: table — Date · Bank · Name · Amount · Category
- [ ] Inline category dropdown: `PATCH /transactions/:id` `{ category_id }`
- [ ] "Uncategorized" filter — one click to see only `category_id = NULL`
- [ ] Auto-categorize on import: match `raw_name` against `category_rules`
- [ ] Rules learning loop: manual override → offer "always categorize this as X" → new `category_rules` row

**Learning outcome:** PATCH endpoints, controlled React inputs, optimistic UI updates.

### Phase 6 — Overview
**Layer:** Full-stack · **Stack:** Knex/SQL aggregation, React · **Estimate:** half day

*The yearly dashboard. Pure SQL + simple React.*

- [ ] `GET /overview?year=YYYY` → `{ category, type, total }[]` grouped by category
- [ ] `OverviewPage`: year selector, category totals table, INFLOW / OUTFLOW split
- [ ] Drill down: click a category total → transactions feeding it (source traceability)
- [ ] Month breakdown: same query grouped by month
- [ ] Account filter: one bank or all

**Learning outcome:** SQL aggregation via Knex, derived data in React without extra state.

### Phase 7 — Mobile + file import from UI
**Layer:** Full-stack · **Stack:** Express (multer, child_process), React (responsive Tailwind) · **Estimate:** 1 day

*Makes the app actually usable on the phone during downtime.*

- [ ] `POST /import` endpoint: file upload (multer), Node spawns Python `db_insert.py` via `child_process`
- [ ] `ImportPage`: file picker, bank selector (BP / C24), upload button, result feedback
- [ ] Transactions table → mobile card list (`useIsMobile()` hook, same pattern as portfolio)
- [ ] Category dropdown usable on mobile (native `<select>` or bottom sheet)
- [ ] Overview readable on small screen
- [ ] Test on real device

**Learning outcome:** file upload in Express, `child_process` Python interop, responsive Tailwind layout.

### Phase 8 — CI/CD + deploy
**Layer:** Full-stack / DevOps · **Stack:** GitHub Actions, Docker, Railway, Vercel · **Estimate:** half day

*Ship it. Same pipeline CREA will use — but CREA is rewired by hand from what's learned here, not extracted as an automated template.*

- [ ] GitHub Actions: lint → test (sample data) → Docker build → deploy to Railway
- [ ] PostgreSQL on Railway
- [ ] Frontend on Vercel — connect repo, set `VITE_API_URL`
- [ ] All secrets in Railway + Vercel dashboards — never in repo
- [ ] Smoke test on production: import sample → categorize → overview
- [ ] Tag `v1.0.0`

**Learning outcome:** full CI/CD, environment management across two platforms.

---

## 6. Banking data privacy — full spec

| What | Decision |
|---|---|
| Real `.tsv` / `.csv` files | ❌ `data/real/` gitignored |
| Real transaction rows | Never committed. Local: Docker volume. Prod: Railway private DB |
| Sample fixtures | ✅ `data/sample/` — synthetic, safe to commit, used by CI |
| `.env` files | ❌ gitignored. `.env.example` committed with placeholders |
| CI/CD | Sample data only — no real transactions in Actions logs |
| Repo visibility | Public once gitignore confirmed. README notes: "real files not included — use your own or sample fixtures" |

---

## 7. Cost

| Service | Usage | Cost |
|---|---|---|
| Railway | Node backend + PostgreSQL | ~$0.50–2 of the free $5/month credit |
| Vercel | React frontend | Free, no limits for personal projects |
| GitHub | Repo + Actions CI | Free (public repo) |
| **Total** | | **$0/month** |

---

## 8. Known data sources

| Source | Format | Parser | Status |
|---|---|---|---|
| La Banque Postale | TSV, ISO-8859-1, 7-row header | `bp.py` → `tsv_to_pdDf()` | ✅ done |
| C24 Bank | CSV, UTF-8 with BOM, semicolon | `c24.py` → `csv_to_pdDf()` | ✅ done |
| PayPal | CSV | — | ❌ not yet |
| Trade Republic | PDF or CSV (TBD) | — | ❌ not yet |
| Open banking PSD2 | API (GoCardless/Nordigen) | — | ❌ phase 2+ |

---

## 9. Remaining work (as of 2026-06-24)

1. Start Phase 1 — React fundamentals sprint (`npm create vite@latest` inside `frontend/`)
2. Create repo `unifin` on GitHub (can happen alongside Phase 1/2, formalized in Phase 3)
3. Create synthetic sample fixtures (`data/sample/sample_bp.tsv`, `data/sample/sample_c24.csv`) — needed by Phase 4
4. Python ETL called via `child_process` — confirmed, lands in Phase 7
