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

Here's a self-contained UniFin slice. React + Vite + TS, no libraries, no API — mock data with a fake delay so `useEffect` has something real to do.
### Phase 1a - Step by Step
#### What it renders

```
┌─────────────────────────────────────────────┐
│  UniFin — Transactions                      │
├─────────────────────────────────────────────┤
│  [ All ] [ Income ] [ Expenses ]            │  ← FilterBar
├─────────────────────────────────────────────┤
│  In 3 200,00 €   Out 1 145,50 €   Net +2054 │  ← SummaryBar
├─────────────────────────────────────────────┤
│  Salary          01/07   +3 200,00 €    [x] │
│  Rent            03/07     -890,00 €    [x] │  ← TransactionList
│  Lidl            05/07      -62,30 €    [x] │     → TransactionItem
│  Deutsche Bahn   09/07     -193,20 €    [x] │
└─────────────────────────────────────────────┘
```

#### Structure

```
src/
├── App.tsx
├── types.ts
├── api/
│   └── transactions.ts          # fake fetch
└── features/transactions/
    ├── TransactionsPage.tsx     # ← useState, useEffect, conditionals, callbacks
    ├── FilterBar.tsx            # ← child → parent callback
    ├── SummaryBar.tsx           # ← useMemo
    ├── TransactionList.tsx      # ← .map()
    └── TransactionItem.tsx      # ← child → parent callback
```

One rule to notice as you read: **only `TransactionsPage` owns state.** Everything below it receives props and calls functions back up. That's the whole architecture.

---

##### `src/types.ts`/

```ts
export type Transaction = {
  id: string;
  label: string;
  amount: number;   // positive = income, negative = expense
  date: string;     // ISO
  category: string;
};

export type Filter = 'all' | 'income' | 'expenses';
```

---

##### `src/api/transactions.ts`

```ts
import type { Transaction } from '../types';

const MOCK: Transaction[] = [
  { id: 't1', label: 'Salary',        amount:  3200.00, date: '2026-07-01', category: 'Income'     },
  { id: 't2', label: 'Rent',          amount:  -890.00, date: '2026-07-03', category: 'Housing'    },
  { id: 't3', label: 'Lidl',          amount:   -62.30, date: '2026-07-05', category: 'Groceries'  },
  { id: 't4', label: 'Deutsche Bahn', amount:  -193.20, date: '2026-07-09', category: 'Transport'  },
];

export function fetchTransactions(): Promise<Transaction[]> {
  return new Promise((resolve) => setTimeout(() => resolve(MOCK), 800));
}
```

---

##### `src/features/transactions/TransactionsPage.tsx`

This is the only file with state. Read it slowly — the other four are trivial once this clicks.

```tsx
import { useState, useEffect } from 'react';
import { fetchTransactions } from '../../api/transactions';
import type { Transaction, Filter } from '../../types';
import { FilterBar } from './FilterBar';
import { SummaryBar } from './SummaryBar';
import { TransactionList } from './TransactionList';

export function TransactionsPage() {
  // ─── useState ───────────────────────────────────────────
  // One useState per independent piece of state. Each returns
  // [currentValue, setterFunction].
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  // ─── useEffect ──────────────────────────────────────────
  // Runs AFTER the first render. The [] means "no dependencies,
  // so never re-run". The `ignore` flag is the cleanup pattern:
  // if the component unmounts mid-fetch, we don't call setState
  // on a dead component.
  useEffect(() => {
    let ignore = false;

    fetchTransactions()
      .then((data) => {
        if (!ignore) {
          setTransactions(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!ignore) {
          setError('Could not load transactions.');
          setIsLoading(false);
        }
      });

    return () => { ignore = true; };   // ← cleanup function
  }, []);

  // ─── Callbacks passed DOWN to children ──────────────────
  // These are just functions. Children call them; state changes
  // here; React re-renders this component and everything below.
  function handleDelete(id: string) {
    setTransactions((current) => current.filter((t) => t.id !== id));
  }

  function handleFilterChange(next: Filter) {
    setFilter(next);
  }

  // ─── Derived value, no memo needed ──────────────────────
  // Filtering 4 items is free. Compute it inline.
  const visible = transactions.filter((t) => {
    if (filter === 'income')   return t.amount > 0;
    if (filter === 'expenses') return t.amount < 0;
    return true;
  });

  // ─── Conditionals: early returns ────────────────────────
  // Cleanest way to handle loading/error states.
  if (isLoading) return <p className="muted">Loading transactions…</p>;
  if (error)     return <p className="error">{error}</p>;

  return (
    <main>
      <h1>UniFin — Transactions</h1>

      <FilterBar active={filter} onChange={handleFilterChange} />
      <SummaryBar transactions={visible} />

      {/* Conditional inline: note `.length > 0`, not `.length` */}
      {visible.length > 0 ? (
        <TransactionList transactions={visible} onDelete={handleDelete} />
      ) : (
        <p className="muted">No transactions match this filter.</p>
      )}
    </main>
  );
}
```

Three things worth internalizing here:

- `setTransactions((current) => …)` — the **updater form**. Use it whenever the new state depends on the old state. Direct `setTransactions(transactions.filter(...))` works here, but breaks subtly when updates batch.
- Never mutate. `.filter()` returns a new array. `transactions.splice(...)` would change nothing on screen, because React compares by reference.
- `{visible.length > 0 ? … : …}` — if you wrote `{visible.length && <List/>}`, an empty list would render a literal `0` on the page. Always compare explicitly.

---

##### `src/features/transactions/FilterBar.tsx`

Child → parent, the simplest possible case.

```tsx
import type { Filter } from '../../types';

type Props = {
  active: Filter;
  onChange: (next: Filter) => void;   // ← the callback prop
};

const OPTIONS: { value: Filter; label: string }[] = [
  { value: 'all',      label: 'All'      },
  { value: 'income',   label: 'Income'   },
  { value: 'expenses', label: 'Expenses' },
];

export function FilterBar({ active, onChange }: Props) {
  return (
    <div className="filter-bar">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}       // ← call the parent
          className={active === opt.value ? 'active' : ''}   // ← conditional class
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
```

This component has **zero state**. It doesn't know which filter is active — it's told via `active`, and it reports clicks via `onChange`. That's a "controlled component," and it's the pattern you want almost everywhere.

Note `onClick={() => onChange(opt.value)}` — the arrow function. Writing `onClick={onChange(opt.value)}` would *call* it during render and cause an infinite loop.

---

##### `src/features/transactions/SummaryBar.tsx`

The one place `useMemo` earns its keep.

```tsx
import { useMemo } from 'react';
import type { Transaction } from '../../types';

type Props = { transactions: Transaction[] };

export function SummaryBar({ transactions }: Props) {
  // useMemo caches the result. It only recalculates when
  // `transactions` changes identity. Everything inside runs
  // once per unique input, not once per render.
  const { income, expenses, net } = useMemo(() => {
    const income = transactions
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = transactions
      .filter((t) => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return { income, expenses, net: income - expenses };
  }, [transactions]);   // ← dependency array

  return (
    <div className="summary-bar">
      <span>In <strong>{formatEUR(income)}</strong></span>
      <span>Out <strong>{formatEUR(expenses)}</strong></span>
      <span className={net >= 0 ? 'positive' : 'negative'}>
        Net <strong>{net >= 0 ? '+' : ''}{formatEUR(net)}</strong>
      </span>
    </div>
  );
}

function formatEUR(value: number) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}
```

Blunt take: with four transactions, this `useMemo` is pointless — it costs more than it saves. Keep it here so you know the syntax, but the honest rule is **write it without `useMemo` first, add it when the profiler tells you to.** It becomes real once UniFin is aggregating 5 000 rows from your bank CSVs.

The dependency array is the whole mechanism: React shallow-compares `[transactions]` against last render. Same reference → return cached result. Different reference → recompute. This is why not mutating arrays matters so much.

---

##### `src/features/transactions/TransactionList.tsx`

Pure `.map()`, nothing else.

```tsx
import type { Transaction } from '../../types';
import { TransactionItem } from './TransactionItem';

type Props = {
  transactions: Transaction[];
  onDelete: (id: string) => void;   // ← passed straight through
};

export function TransactionList({ transactions, onDelete }: Props) {
  return (
    <ul className="transaction-list">
      {transactions.map((t) => (
        <TransactionItem
          key={t.id}          // ← stable ID, never the array index
          transaction={t}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}
```

`key={t.id}` is not decoration. React uses it to match elements between renders. Use the array index instead and deleting the second row will visually delete the wrong one once components hold their own state.

Notice this component just forwards `onDelete` without touching it. That's prop drilling — fine at two levels, annoying at five. When it gets annoying, that's your signal to reach for Context.

---

##### `src/features/transactions/TransactionItem.tsx`

```tsx
import type { Transaction } from '../../types';

type Props = {
  transaction: Transaction;
  onDelete: (id: string) => void;
};

export function TransactionItem({ transaction, onDelete }: Props) {
  const { id, label, amount, date, category } = transaction;
  const isIncome = amount > 0;

  return (
    <li className="transaction-item">
      <div>
        <span className="label">{label}</span>
        {/* conditional rendering: only show category if it exists */}
        {category && <span className="category">{category}</span>}
      </div>

      <span className="date">
        {new Date(date).toLocaleDateString('de-DE')}
      </span>

      <span className={isIncome ? 'amount positive' : 'amount negative'}>
        {isIncome ? '+' : ''}
        {new Intl.NumberFormat('de-DE', {
          style: 'currency', currency: 'EUR',
        }).format(amount)}
      </span>

      <button
        onClick={() => onDelete(id)}     // ← fires the parent's handler
        aria-label={`Delete ${label}`}
      >
        ×
      </button>
    </li>
  );
}
```

---

##### `src/App.tsx`

```tsx
import { TransactionsPage } from './features/transactions/TransactionsPage';

export default function App() {
  return <TransactionsPage />;
}
```

---

#### The data flow, in one paragraph

`TransactionsPage` holds all state. It passes **data down** as props (`transactions`, `active`, `transaction`) and **functions down** as props (`onDelete`, `onChange`). A user clicks the `×` in `TransactionItem` → it calls `onDelete(id)` → that's `handleDelete` in the page → `setTransactions` runs → React re-renders `TransactionsPage` and every component below it with fresh props. Children never modify anything; they only report events upward. Data flows down, events flow up.

#### Try breaking it

Best way to actually learn this:

1. Change `key={t.id}` to `key={index}` and delete a middle row. Watch the mismatch.
2. Replace `setTransactions((c) => c.filter(...))` with `transactions.splice(...)`. Nothing happens — mutation is invisible to React.
3. Remove `[]` from `useEffect`. Infinite fetch loop, because the effect sets state, which re-renders, which re-runs the effect.
4. Change `{visible.length > 0 ? … : …}` to `{visible.length && <TransactionList … />}` and filter to something empty. A `0` appears on the page.

Each of those is a bug you'd otherwise hit for real in week three.

#### STEP-BY-STEP Roadmap
Good instinct to build it yourself. Here's the plan as ordered checkpoints — each one ends with something you can see working before moving on. Don't skip ahead; if a checkpoint doesn't render, fix it before continuing.

You already have all the component code from my last message. This plan is the *sequence* to type it in, plus the router part (which is new). React Router is at v7 now — install `react-router-dom`, and the setup below is current for it.

---

##### Etape 0 — Scaffold (5 min)

```bash
npm create vite@latest unifin -- --template react-ts
cd unifin
npm install
npm run dev
```

**Checkpoint:** default Vite page loads at `localhost:5173`. Now delete the boilerplate: empty out `App.tsx`, delete `App.css` and the logo imports. Blank screen = ready.

---

##### Etape 1 — Types + fake API (10 min)

Build the data layer first, before any UI. Nothing to render, but everything depends on it.

1. Create `src/types.ts` → paste the `Transaction` / `Filter` types.
2. Create `src/api/transactions.ts` → paste the mock array + `fetchTransactions`.

**Checkpoint:** no visual change, but `npm run dev` shows **zero TypeScript errors** in the terminal. If it's red here, it'll be red everywhere — fix now.

---

##### Etape 2 — Static list, no state (20 min)

Get pixels on screen with **hardcoded** data before touching `useState`. This isolates "can I render a list" from "can I manage state."

1. Create `TransactionItem.tsx` — but temporarily **delete the `onDelete` prop and the button.** Just render one row.
2. Create `TransactionList.tsx` with the `.map()`, also **without `onDelete`** for now.
3. In `App.tsx`, import `MOCK` directly and render `<TransactionList transactions={MOCK} />`.

**Checkpoint:** four rows visible, formatted euros, dates. Ugly is fine. This proves `.map()` + `key` + props-down works. **This is your first `.map()` win — stop and confirm it before adding state.**

---

##### Etape 3 — Add state + loading (25 min)

Now introduce `TransactionsPage.tsx` — the brain.

1. Create it with **only** `useState` for `transactions` + `isLoading`, and the `useEffect` that calls `fetchTransactions`.
2. Add the two early-return conditionals (`isLoading`, then the list).
3. Point `App.tsx` at `<TransactionsPage />` instead of the static list.

**Checkpoint:** you see "Loading transactions…" for ~0.8s, then the four rows. That flash is `useEffect` + `useState` working together. If it loads instantly, your fake delay isn't wired. If it *never* loads, check the `[]` dep array.

---

##### Etape 4 — Delete (child → parent callback) (20 min)

Now wire the upward flow.

1. Add `handleDelete` in `TransactionsPage`, pass it down through `TransactionList` into `TransactionItem`.
2. Put the `×` button back in `TransactionItem`, `onClick={() => onDelete(id)}`.

**Checkpoint:** clicking `×` removes that row. This is the whole "events flow up" model in one interaction. Deliberately test the `key` bug here: temporarily switch to `key={index}`, delete the 2nd row, watch it misbehave, then switch back. That mistake will cost you an hour someday — feel it now while it's cheap.

---

##### Etape 5 — Filter (second callback) + memo (20 min)

1. Add `filter` state + `handleFilterChange` to the page.
2. Create `FilterBar.tsx`, wire `onChange` up.
3. Add the `visible` filtered array and the empty-state conditional (`length > 0 ? … : …`).
4. Create `SummaryBar.tsx` with `useMemo`.

**Checkpoint:** three filter buttons switch the list; summary totals update; filtering to an empty result shows your empty message, **not a literal `0`**. Test that on purpose.

**Ship it.** This is a complete, working transactions page — a clean stopping point if it's late. The router is a separate session's worth if you're tired.

---

##### Etape 6 — Router (30 min)

###### step by step
###### Step 1 — Install & wire up the router skeleton

npm install react-router-dom (in frontend/)
In main.tsx, wrap <App /> in <BrowserRouter>. This has to happen above App, since App will use <Routes>/<Link>/useNavigate, which only work inside a Router context.
In App.tsx, replace the hardcoded <TransactionPage /> with <Routes> containing two <Route>s: / → DashboardPage, /transactions → TransactionPage.
Stop here, run it, confirm both URLs render the right stub page.

###### Step 2 — NavBar with programmatic navigation

Build NavBar.tsx with two buttons/links: "Home" and "Transactions".
Since you asked for programmatic navigation (not just <Link>), use useNavigate() and onClick={() => navigate("/transactions")} rather than <Link to=...>. (Note: <Link> is the idiomatic choice for plain nav — useNavigate is for navigating in response to logic, e.g. after a form submit. Fine to use it here since you asked, but flagging the distinction since it's new territory.)
Add <NavBar /> in App.tsx above <Routes> so it persists across pages.
Stop, confirm clicking nav buttons switches pages and highlights nothing yet (styling later).

###### Step 3 — Dashboard page shell

Flesh out DashboardPage.tsx (currently garbage placeholder) with three pieces, composed but built separately:
RecentTransactions component — reuses TransactionItem/TransactionList filtered to last 3 days (client-side filter on your existing mock/API data by date).
A tiny bar chart (income / expenses / net) — pull in the dataviz skill before writing this, and decide chart lib now: Recharts is the standard React choice, lightweight enough for a 3-bar chart.
"See all" button → useNavigate() to /transactions.
Build these one at a time, not all in one shot per your working style — recommend order: RecentTransactions first (reuses existing components), then the button (trivial), then the chart last (new dependency + new concept).

###### Step 4 — Tests

Per Etape 1 checklist: a routing test (nav click → URL/page changes), not full coverage.
##### Code

Only start this once Etape 5 works. Now you add a Dashboard page and navigation.

```bash
npm install react-router-dom
```

**Step 6a — a stub Dashboard.** Create `src/features/dashboard/DashboardPage.tsx` returning just `<h1>Dashboard</h1>`. You need somewhere to navigate *to*.

**Step 6b — a layout with nav.** Create `src/App.tsx` as a shell holding the navigation plus an `<Outlet />` — the slot where the active page renders:

```tsx
import { NavLink, Outlet } from 'react-router-dom';

export default function App() {
  return (
    <div>
      <nav className="main-nav">
        <NavLink to="/">Dashboard</NavLink>
        <NavLink to="/transactions">Transactions</NavLink>
      </nav>
      <Outlet />   {/* active route renders here */}
    </div>
  );
}
```

`NavLink` is like `Link` but auto-adds an `active` class to the current page — free highlighting.

**Step 6c — wire the router in `main.tsx`:**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { TransactionsPage } from './features/transactions/TransactionsPage';
import './index.css';

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,          // the layout (nav + Outlet)
    children: [
      { index: true, element: <DashboardPage /> },       // "/"
      { path: 'transactions', element: <TransactionsPage /> }, // "/transactions"
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
```

**Checkpoint:** nav bar at top; clicking swaps between Dashboard and Transactions **without a full page reload**; the URL changes; the active link is highlighted; browser back/forward works. That last part — free back-button support — is the whole point of a router over a `useState` "which page" toggle.

---

#### Etape 7 — Programmatic navigation (10 min, optional)

To navigate from *code* instead of a link (e.g. click a transaction → go somewhere):

```tsx
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();
// then, in a handler:
navigate('/transactions');
```

Drop a button on the Dashboard that jumps to Transactions. That's the pattern you'll use after form submits later.

---

##### Mental model for the router

Three moving parts: the **route config** (`createBrowserRouter`, the URL→component map), the **layout** (`App`, holds nav + `<Outlet/>`), and the **`Outlet`** (the hole the matched child fills). `Link`/`NavLink` change the URL without reloading; the config decides what renders. Everything from Etapes 1–5 is untouched — `TransactionsPage` doesn't know or care that it's now behind a route. That's the payoff of keeping state ownership clean.

---

Realistic timing: Etapes 0–5 are a solid tonight (~2 hrs with debugging). If you're fried after shipping Etape 5, stop there and do the router fresh — it's cleaner in your head when you're not tired. Want a stub Dashboard that actually shows the `SummaryBar` totals (reusing that component across both routes), or keep it a placeholder for tonight?



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

**Resolved:** asserting "did navigation happen" needed a real `<Routes>` tree (not a bare `MemoryRouter`) — wrap `DashboardPage` in `<Routes><Route path="/" element={<DashboardPage />} /><Route path="/transactions" element={<h1>Transactions</h1>} /></Routes>`, click "See all", then assert the dummy `/transactions` heading rendered. A bare `MemoryRouter` has nowhere to navigate *to*, so `useNavigate()` changing the in-memory history has no visible effect without a matching `<Route>`.

**Step 4b status: done.** All components now have tests — `NavBar`, `RecentTransactions`, `SummaryChart`, `DashboardPage`, `TransactionPage` (9 test files, 24 tests total, all passing).

Two things the test-writing surfaced, not yet fixed in the components themselves:
- `RecentTransactions.tsx` sets an `error` state on fetch rejection but never renders it — falls through to the "no transactions" empty state instead. `TransactionPage.tsx` handles this correctly (`if (error) return <p className="error">{error}</p>;`); `RecentTransactions` should do the same.
- `SummaryBar.tsx` still has the dead `totalIncome` function referencing a nonexistent `Transactions` type (flagged in Step 4, not fixed).

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

**Step 5/6 status: done, as of 2026-07-27.** Cypress installed and `frontend/cypress/e2e/navigation.cy.ts` written and passing, with a `cy.go("back")` test added beyond the original plan (real browser back/forward — something RTL can't test at all). Bugs the process surfaced and fixed along the way:

- `NavBar`'s "Transactions"/"Home" are `<NavLink>` (renders as `<a>`), not `<button>` — `cy.contains("button", ...)` silently never matches; must use `cy.contains("a", ...)` or drop the tag constraint.
- `.should("include", /regex/)` doesn't work — Chai's `include` assertion expects a **string**, not a regex, for substring checks. Use `.should("include", "/transactions")` (string) or `.should("match", /transactions/i)` (regex) — two different assertion verbs, not interchangeable.
- Real bug in `SummaryChart.tsx`: its `fetchTransactions().then(...)` had no `.catch()`, unlike `RecentTransactions`/`TransactionPage`. Combined with the mock API's original 20% random rejection, this surfaced as an **unhandled promise rejection** that Cypress treats as an automatic test failure (uncaught app errors always fail the current test, by design). Fixed by adding the missing `.catch()`.
- Root-caused further: that 20% random rejection in `api/transactions.ts` (originally added just to eyeball the loading/error UI once by hand) had no business being in code exercised by automated tests — removed it entirely. Deterministic mocks over "realistic" flaky ones; the actual error-path UI is still covered deliberately in Vitest via `mockRejectedValue`.
- Needed a dedicated `cypress/tsconfig.json` (scoped to `cypress/**/*.ts`, `types: ["cypress", "node"]`) since the project uses TS project references (`tsconfig.app.json` only `include`s `src`, `tsconfig.node.json` only the Vite config) — neither covered the `cypress/` folder, so `cy.*` types needed their own config rather than being bolted onto an existing one.

**Learning outcome:** the RTL vs Cypress split — RTL for fast, isolated component behavior (runs in every CI push, no browser needed); Cypress for real user-facing flows across the whole app (slower, browser-based, run less often or pre-merge), and the *only* layer that can test real browser history (`cy.go("back")`), a real address bar, and uncaught runtime errors. This is the same split CREA will use.

**Phase 1b complete.** Next: Phase 1c — TransactionForm + LoginPage.

### Phase 1c — TransactionForm + LoginPage

**Layer:** Frontend · **Stack:** React, TypeScript, Vitest, React Testing Library · **Estimate:** half day

Closes out the two Phase 1 items that were still open: `<TransactionForm>` (line 133) and the `/login` route (line 136). `LoginPage` goes one step past "empty page" — it's a real controlled form with a no-op submit, since there's no backend yet to call (that wiring is Phase 2).

Decisions locked (2026-07-27):
- TransactionForm submitting **adds to `TransactionPage`'s existing state** via a lifted callback — not a standalone/console-log form. Same callback-prop pattern as `onDelete`.
- LoginPage is a **full controlled form** (email/password, `useState`), `onSubmit` just `console.log`s — real JWT POST happens in Phase 2.

---

#### Part A — TransactionForm

**Step A1 — `TransactionForm.tsx` skeleton, controlled inputs only**

New file: `frontend/src/features/transactions/TransactionForm.tsx`. Four `useState` calls (one per field, matching the one-state-var-per-concern style already used in `TransactionPage`), each input controlled via `value`/`onChange`. No submit logic yet.

```tsx
import { useState } from "react";

export function TransactionForm() {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Label"
        className="rounded-(--radius-DEFAULT) border border-border px-2 py-1"
      />
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount"
        className="rounded-(--radius-DEFAULT) border border-border px-2 py-1"
      />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="rounded-(--radius-DEFAULT) border border-border px-2 py-1"
      />
      <input
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="Category"
        className="rounded-(--radius-DEFAULT) border border-border px-2 py-1"
      />
      <button
        type="submit"
        className="rounded-full bg-primary px-3 py-1 text-sm font-medium text-white"
      >
        Add
      </button>
    </form>
  );
}
```

**Step A2 — Props contract: how the form talks to its parent**

`onAdd` callback prop, same shape as `TransactionItem`'s `onDelete`. `Omit<Transaction, "id">` because the form never invents its own id — the parent does, same as a real backend would.

```tsx
import { useState } from "react";
import type { Transaction } from "../../types/types";

type Props = {
  onAdd: (t: Omit<Transaction, "id">) => void;
};

export function TransactionForm({ onAdd }: Props) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onAdd({
      label,
      amount: Number(amount),
      date,
      category,
    });
    setLabel("");
    setAmount("");
    setDate("");
    setCategory("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
      {/* inputs as in Step A1, unchanged */}
    </form>
  );
}
```

**Step A3 — Wire into `TransactionPage`**

Reuses the existing `transactions` state — no new `useState`. New handler next to `handleDelete`, same new-array-not-mutation rule.

```tsx
function handleAddTransaction(t: Omit<Transaction, "id">) {
  setTransactions((current) => [...current, { ...t, id: crypto.randomUUID() }]);
}
```

```tsx
<TransactionForm onAdd={handleAddTransaction} />
```

**Step A4 — Test**

`TransactionForm.test.tsx` — mock the `onAdd` callback, fill inputs via `user-event`, submit, assert the mock was called with the right object. Doesn't touch `TransactionPage` state — that's a separate integration concern.

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, test, expect } from "vitest";
import { TransactionForm } from "./TransactionForm";

test("submits a filled-in transaction", async () => {
  const onAdd = vi.fn();
  render(<TransactionForm onAdd={onAdd} />);

  await userEvent.type(screen.getByPlaceholderText("Label"), "Coffee");
  await userEvent.type(screen.getByPlaceholderText("Amount"), "-3.5");
  await userEvent.type(screen.getByPlaceholderText("Category"), "Food");
  await userEvent.click(screen.getByRole("button", { name: "Add" }));

  expect(onAdd).toHaveBeenCalledWith(
    expect.objectContaining({ label: "Coffee", amount: -3.5, category: "Food" })
  );
});
```

---

#### Part B — LoginPage

**Step B1 — `LoginPage.tsx`, controlled email/password**

New file: `frontend/src/features/auth/LoginPage.tsx` — new `features/auth/` slice, parallel to `dashboard/` and `transactions/`. No callback prop — nothing to lift into yet, Phase 2 replaces the `console.log` with a real `POST /api/auth/login`.

```tsx
import { useState } from "react";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log({ email, password });
  }

  return (
    <main className="flex flex-col gap-3 p-4">
      <h1>Log in</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="rounded-(--radius-DEFAULT) border border-border px-2 py-1"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="rounded-(--radius-DEFAULT) border border-border px-2 py-1"
        />
        <button
          type="submit"
          className="rounded-full bg-primary px-3 py-1 text-sm font-medium text-white"
        >
          Log in
        </button>
      </form>
    </main>
  );
}
```

**Step B2 — Wire into routing**

```tsx
import { LoginPage } from "./features/auth/LoginPage";
// ...
<Route path="/login" element={<LoginPage />} />
```

Plus a `/login` `NavLink` in `NavBar.tsx`, matching its existing links.

**Step B3 — Test**

`LoginPage.test.tsx` — render, fill both fields, submit, assert nothing throws. Full behavioral assertion (spying on a real handler) comes in Phase 2 once there's an actual API call to mock.

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { test } from "vitest";
import { LoginPage } from "./LoginPage";

test("fills in and submits without throwing", async () => {
  render(<LoginPage />);
  await userEvent.type(screen.getByPlaceholderText("Email"), "me@example.com");
  await userEvent.type(screen.getByPlaceholderText("Password"), "hunter2");
  await userEvent.click(screen.getByRole("button", { name: "Log in" }));
});
```

**Phase 1c complete (once built). Next: Phase 2 — Express backend + auth sprint.**

### Phase 2 — Express backend + auth sprint
**Layer:** Backend · **Stack:** Node, Express, TypeScript, ts-node-dev, Docker Compose, PostgreSQL, Knex, JWT, bcrypt, Supertest, Vitest · **Estimate:** 1 day (weekend)

*Sequencing note (2026-07-27): the original split had Phase 2 querying Postgres via Knex before Docker Compose + the first migration existed (that was Phase 3). Fixed by pulling the Docker/Knex bootstrap forward into 2a. Phase 3 shrinks to CI + the `useAuth` hook/protected-route wrapper on top of what 2b already wires up.*

#### Phase 2a — Docker + Knex + Express skeleton + transactions CRUD

**What it produces**

```
docker compose up
     ↓
┌──────────────┐        ┌──────────────┐
│  app (Node)  │──HTTP──│   frontend   │  (not yet — Phase 3 wires this)
│  :4000       │        └──────────────┘
│              │
│  GET  /api/transactions      → 200 [ {...}, {...} ]
│  GET  /api/transactions/:id  → 200 {...} | 404
│  POST /api/transactions      → 201 {...} | 400
└──────┬───────┘
       │ Knex
┌──────▼───────┐
│  postgres    │
│  :5432       │
│  transactions│  ← one migration, minimal columns for now
└──────────────┘
```

**Structure**

```
backend/
├── src/
│   ├── routes/
│   │   └── transactions.ts     # URL + method → controller
│   ├── controllers/
│   │   └── transactions.ts     # req/res, validation
│   ├── services/
│   │   └── transactions.ts     # Knex queries, no req/res
│   ├── db/
│   │   ├── knex.ts             # Knex instance, reads DATABASE_URL
│   │   └── migrations/
│   │       └── 20260727_create_transactions.ts
│   ├── middleware/
│   │   └── error.ts            # catches thrown errors → JSON response
│   └── index.ts                # Express app entry
├── knexfile.ts
├── .env                          # ❌ gitignored
├── .env.example                  # ✅ committed
├── package.json
└── tsconfig.json
```

---

##### `docker-compose.yml` (repo root)

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: unifin
      POSTGRES_PASSWORD: unifin
      POSTGRES_DB: unifin
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:                          # ← new key: app waits until Postgres actually accepts connections
      test: ["CMD-SHELL", "pg_isready -U unifin"]
      interval: 2s
      timeout: 2s
      retries: 10

  app:
    build: ./backend
    ports:
      - "4000:4000"
    env_file: ./backend/.env
    depends_on:
      postgres:
        condition: service_healthy       # ← waits on the healthcheck above, not just "container started"
    volumes:
      - ./backend:/app
      - /app/node_modules

volumes:
  pgdata:
```

You know Compose structure from CI already — the two new keys here are `healthcheck` (defines "ready", not just "running") and `depends_on.condition: service_healthy` (Express would otherwise try to connect to Postgres microseconds after the container starts and fail).

---

##### `backend/.env.example`

```
DATABASE_URL=postgres://unifin:unifin@postgres:5432/unifin
PORT=4000
```

Note the host is `postgres` — the Compose service name, not `localhost`. Inside the Docker network, containers resolve each other by service name (same idea as a Docker DNS entry).

---

##### `backend/src/db/knex.ts`

```ts
import knex from 'knex';

// Alembic analogy: this is your engine/session setup — one shared
// connection pool the rest of the app imports.
export const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL,
});
```

##### `backend/knexfile.ts`

```ts
import type { Knex } from 'knex';

const config: Knex.Config = {
  client: 'pg',
  connection: process.env.DATABASE_URL,
  migrations: {
    directory: './src/db/migrations',
  },
};

export default config;
```

The CLI (`npx knex migrate:latest`) reads this file directly — it's separate from `knex.ts` because the CLI runs outside your app process and needs its own config entry point.

---

##### `backend/src/db/migrations/20260727_create_transactions.ts`

Minimal columns for now — just enough for CRUD. Phase 4 adds `category_id`, `source_file`, `imported_at` once `categories`/`category_rules` exist (adding nullable columns later is a normal follow-up migration, not a redo of this one).

```ts
import type { Knex } from 'knex';

// Alembic analogy: `up` ≈ `upgrade()`, `down` ≈ `downgrade()`.
// Migrations are append-only — never edit this file once it has run
// against a real database; write a new migration instead.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('transactions', (table) => {
    table.increments('id').primary();
    table.date('date').notNullable();
    table.string('raw_name').notNullable();
    table.decimal('amount', 10, 2).notNullable();
    table.enu('flow', ['income', 'expense']).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('transactions');
}
```

Run it with `npx knex migrate:latest` (inside the `app` container, or locally against the exposed `5432` port) — this is the moment the `transactions` table actually appears in Postgres.

---

##### `backend/src/services/transactions.ts`

The only file that talks to the database. Controllers never import `db` directly — this is the "services ≈ functions your Flask view calls" boundary from CLAUDE.md.

```ts
import { db } from '../db/knex';

export type Transaction = {
  id: number;
  date: string;
  raw_name: string;
  amount: string;      // Knex returns numeric columns as strings — cast at the edge, not here
  flow: 'income' | 'expense';
};

export function getAllTransactions(): Promise<Transaction[]> {
  return db('transactions').select('*').orderBy('date', 'desc');
}

export function getTransactionById(id: number): Promise<Transaction | undefined> {
  return db('transactions').where({ id }).first();
}

export function createTransaction(input: {
  date: string;
  raw_name: string;
  amount: number;
  flow: 'income' | 'expense';
}): Promise<Transaction> {
  return db('transactions').insert(input).returning('*').then((rows) => rows[0]);
}
```

`.returning('*')` is Postgres-specific (SQLite/MySQL need a follow-up `SELECT`) — fine here since Postgres is locked in.

---

##### `backend/src/controllers/transactions.ts`

```ts
import type { Request, Response } from 'express';
import * as transactionsService from '../services/transactions';

export async function listTransactions(req: Request, res: Response) {
  const transactions = await transactionsService.getAllTransactions();
  res.json(transactions);
}

export async function getTransaction(req: Request, res: Response) {
  const id = Number(req.params.id);
  const transaction = await transactionsService.getTransactionById(id);

  if (!transaction) {
    return res.status(404).json({ error: 'Transaction not found' });
  }
  res.json(transaction);
}

export async function createTransaction(req: Request, res: Response) {
  const { date, raw_name, amount, flow } = req.body;

  if (!date || !raw_name || amount === undefined || !flow) {
    return res.status(400).json({ error: 'date, raw_name, amount, flow are required' });
  }

  const created = await transactionsService.createTransaction({ date, raw_name, amount, flow });
  res.status(201).json(created);
}
```

This is the req/res layer — it never constructs SQL. If you ever swap Knex for something else, this file doesn't change.

---

##### `backend/src/routes/transactions.ts`

```ts
import { Router } from 'express';
import * as controller from '../controllers/transactions';

// Express Router ≈ a Flask Blueprint: a mountable group of routes
export const transactionsRouter = Router();

transactionsRouter.get('/', controller.listTransactions);
transactionsRouter.get('/:id', controller.getTransaction);
transactionsRouter.post('/', controller.createTransaction);
```

---

##### `backend/src/index.ts`

```ts
import express from 'express';
import { transactionsRouter } from './routes/transactions';

const app = express();
app.use(express.json());              // ← without this, req.body is undefined on POST

app.use('/api/transactions', transactionsRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend listening on :${PORT}`));
```

`express.json()` is middleware — think of it as the decorator that runs before every request in this app, parsing the JSON body onto `req.body`. Forget it and every `POST` silently gives you `undefined`.

---

##### Testing — one Supertest file per route file

```ts
// backend/src/routes/transactions.test.ts
import request from 'supertest';
import { app } from '../index';           // export `app` separately from `app.listen(...)` so tests can import it without binding a port
import { db } from '../db/knex';

beforeEach(async () => {
  await db('transactions').truncate();     // clean slate per test — no leftover rows between tests
});

afterAll(async () => {
  await db.destroy();                       // closes the pool, or Vitest hangs waiting for open handles
});

test('GET /api/transactions returns 200 and an empty array', async () => {
  const res = await request(app).get('/api/transactions');
  expect(res.status).toBe(200);
  expect(res.body).toEqual([]);
});

test('POST /api/transactions with missing fields returns 400', async () => {
  const res = await request(app).post('/api/transactions').send({ date: '2026-07-27' });
  expect(res.status).toBe(400);
});

test('GET /api/transactions/:id returns 404 for unknown id', async () => {
  const res = await request(app).get('/api/transactions/9999');
  expect(res.status).toBe(404);
});
```

Runs against the real Postgres in Docker (not a mock) — `truncate()` in `beforeEach` is what keeps tests isolated instead of a separate test-DB setup, which is overkill for a single-user personal tool.

**2a done when:** `docker compose up`, `npx knex migrate:latest`, then all three Supertest cases pass and a manual `curl -X POST localhost:4000/api/transactions -d '{...}'` round-trips through to Postgres.

---

#### Phase 2b — JWT auth

**What it adds on top of 2a**

```
POST /api/auth/login  { email, password }
        │
        ▼
  bcrypt.compare(password, ADMIN_PASSWORD_HASH)
        │
   match?──no──▶ 401
        │yes
        ▼
  jwt.sign({ sub: email }, JWT_SECRET, { expiresIn: '7d' })
        ▼
  { token: "eyJhbGc..." }        ← client stores this, sends it back on every request

Any request to /api/transactions/*
        │
        ▼
  authMiddleware: reads "Authorization: Bearer <token>"
        │
   valid?──no──▶ 401
        │yes
        ▼
  controller runs as before
```

**Structure — new/changed files**

```
backend/
├── src/
│   ├── routes/
│   │   └── auth.ts             # new
│   ├── controllers/
│   │   └── auth.ts             # new
│   ├── middleware/
│   │   └── auth.ts             # new — protects transactions routes
│   └── index.ts                # mounts /api/auth, applies auth middleware
frontend/
├── src/
│   ├── api/
│   │   └── auth.ts             # new — login(), attaches token to fetch
│   ├── hooks/
│   │   └── useAuth.ts          # new — reads/writes token, exposes isLoggedIn
│   └── pages/LoginPage.tsx     # filled in (was an empty stub from Phase 1)
```

---

##### Generating the hardcoded credentials (you run this once, by hand)

```bash
node -e "console.log(require('bcrypt').hashSync('yourRealPassword', 10))"
```

Paste the output into `backend/.env` as `ADMIN_PASSWORD_HASH`. The plaintext password is never stored — only its hash, and only bcrypt (not you) can check a candidate password against it.

##### `backend/.env.example` (extended)

```
DATABASE_URL=postgres://unifin:unifin@postgres:5432/unifin
PORT=4000
JWT_SECRET=replace-with-a-long-random-string
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD_HASH=$2b$10$replace-with-real-hash
```

---

##### `backend/src/controllers/auth.ts`

```ts
import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  const isEmailCorrect = email === process.env.ADMIN_EMAIL;
  const isPasswordCorrect = isEmailCorrect
    ? await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH!)
    : false;                                    // ← still runs compare-shaped work below either way, see note

  if (!isEmailCorrect || !isPasswordCorrect) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ sub: email }, process.env.JWT_SECRET!, { expiresIn: '7d' });
  res.json({ token });
}
```

Security detail worth internalizing: `bcrypt.compare` is deliberately slow (that's the point — it resists brute force), so short-circuiting it entirely on a wrong email creates a timing side-channel (wrong-email responses return faster than wrong-password ones, letting an attacker enumerate valid emails by timing). For a single-user personal tool this risk is close to theoretical, but it's the kind of detail worth knowing once, since CREA (multi-user) inherits this exact login function.

---

##### `backend/src/routes/auth.ts`

```ts
import { Router } from 'express';
import * as controller from '../controllers/auth';

export const authRouter = Router();
authRouter.post('/login', controller.login);
```

---

##### `backend/src/middleware/auth.ts`

```ts
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Express middleware ≈ a decorator wrapping every route it's applied to:
// runs before the controller, can short-circuit the request (401) or
// call next() to let it continue.
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;      // "Bearer eyJhbGc..."
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET!);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
```

---

##### `backend/src/index.ts` (updated)

```ts
import express from 'express';
import { transactionsRouter } from './routes/transactions';
import { authRouter } from './routes/auth';
import { requireAuth } from './middleware/auth';

export const app = express();
app.use(express.json());

app.use('/api/auth', authRouter);                          // public
app.use('/api/transactions', requireAuth, transactionsRouter); // protected — requireAuth runs first

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Backend listening on :${PORT}`));
}
```

`requireAuth` passed as a second argument to `app.use` applies it to every route inside `transactionsRouter` — you don't repeat it per-route. The `require.main === module` guard is what lets Supertest `import { app }` in 2a's tests without also binding a real port during test runs.

---

##### `frontend/src/api/auth.ts`

```ts
export async function login(email: string, password: string): Promise<string> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) throw new Error('Invalid credentials');

  const { token } = await res.json();
  localStorage.setItem('token', token);
  return token;
}

export function authHeader(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function logout() {
  localStorage.removeItem('token');
}
```

Every existing fetch wrapper in `frontend/src/api/` (e.g. `transactions.ts`) now needs `headers: authHeader()` merged in — that's the "wire it in" step, not a new concept.

---

##### `frontend/src/hooks/useAuth.ts`

```ts
import { useState } from 'react';

// Same useState pattern as TransactionsPage — one hook, one piece of
// state (isLoggedIn), reused everywhere auth status matters.
export function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('token'));

  function markLoggedIn() { setIsLoggedIn(true); }
  function markLoggedOut() { localStorage.removeItem('token'); setIsLoggedIn(false); }

  return { isLoggedIn, markLoggedIn, markLoggedOut };
}
```

Kept deliberately thin here — Phase 3 promotes this into a `useAuth` + Context-backed protected-route wrapper so `isLoggedIn` doesn't need re-deriving in every component that calls the hook.

---

##### `frontend/src/pages/LoginPage.tsx`

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/auth';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { markLoggedIn } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login(email, password);
      markLoggedIn();
      navigate('/');                    // programmatic nav — useNavigate, not <Link>, since it's inside a handler
    } catch {
      setError('Invalid email or password.');
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
      <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" />
      {error && <p className="error">{error}</p>}
      <button type="submit">Log in</button>
    </form>
  );
}
```

**2b done when:** `curl -X POST localhost:4000/api/auth/login -d '{"email":...,"password":...}'` returns a token, that same token in an `Authorization: Bearer` header gets you a 200 from `/api/transactions`, a missing/garbage token gets 401, and the `LoginPage` form round-trips through to a working `localStorage` token from the real browser.

**Learning outcome:** Docker Compose with a real healthcheck/depends_on chain, Knex migrations end-to-end, Express routing + middleware, bcrypt/JWT auth internals (including the timing-safety caveat), protected routes, and wiring frontend auth to a real API.

### Phase 3 — Skeleton hardening
**Layer:** Full-stack · **Stack:** React Context, GitHub Actions · **Estimate:** 2–3 hours

*Docker Compose + Knex + the login flow already exist as of Phase 2a/2b. This phase formalizes auth on the frontend and wraps everything in CI — what's left of the original "skeleton hardening" scope.*

- [ ] Create repo `unifin` on GitHub (start private, make public once gitignore confirmed)
- [ ] `.gitignore` — first thing written: `data/real/`, `backend/.env`, `frontend/.env`, `CLAUDE.local.md`
- [ ] `GET /health` route, confirmed reachable through Docker (no auth required — used by CI/deploy checks)
- [ ] Tailwind setup on the frontend, Vite dev-server proxy → backend
- [ ] Promote Phase 2b's `useAuth` into a Context provider so `isLoggedIn` doesn't need re-deriving per component
- [ ] Protected route wrapper (`<RequireAuth>`) around `/`, `/transactions` — redirects to `/login` when logged out
- [ ] GitHub Actions CI: lint + build on push, backend tests against a Postgres service container
- [ ] Confirm full loop: login → protected page → `GET /health` with token → 200, logout → redirected to `/login`

**Learning outcome:** React Context for cross-cutting state (auth), protected-route pattern, CI running against a real ephemeral Postgres — the parts CREA will fork.

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
