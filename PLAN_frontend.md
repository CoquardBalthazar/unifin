
Here's a self-contained UniFin slice. React + Vite + TS, no libraries, no API — mock data with a fake delay so `useEffect` has something real to do.

# CODE with concepts
## What it renders

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

## Structure

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

### `src/types.ts`/

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

### `src/api/transactions.ts`

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

### `src/features/transactions/TransactionsPage.tsx`

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

### `src/features/transactions/FilterBar.tsx`

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

### `src/features/transactions/SummaryBar.tsx`

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

### `src/features/transactions/TransactionList.tsx`

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

### `src/features/transactions/TransactionItem.tsx`

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

### `src/App.tsx`

```tsx
import { TransactionsPage } from './features/transactions/TransactionsPage';

export default function App() {
  return <TransactionsPage />;
}
```

---

## The data flow, in one paragraph

`TransactionsPage` holds all state. It passes **data down** as props (`transactions`, `active`, `transaction`) and **functions down** as props (`onDelete`, `onChange`). A user clicks the `×` in `TransactionItem` → it calls `onDelete(id)` → that's `handleDelete` in the page → `setTransactions` runs → React re-renders `TransactionsPage` and every component below it with fresh props. Children never modify anything; they only report events upward. Data flows down, events flow up.

## Try breaking it

Best way to actually learn this:

1. Change `key={t.id}` to `key={index}` and delete a middle row. Watch the mismatch.
2. Replace `setTransactions((c) => c.filter(...))` with `transactions.splice(...)`. Nothing happens — mutation is invisible to React.
3. Remove `[]` from `useEffect`. Infinite fetch loop, because the effect sets state, which re-renders, which re-runs the effect.
4. Change `{visible.length > 0 ? … : …}` to `{visible.length && <TransactionList … />}` and filter to something empty. A `0` appears on the page.

Each of those is a bug you'd otherwise hit for real in week three.

# STEP-BY-STEP Roadmap
Good instinct to build it yourself. Here's the plan as ordered checkpoints — each one ends with something you can see working before moving on. Don't skip ahead; if a checkpoint doesn't render, fix it before continuing.

You already have all the component code from my last message. This plan is the *sequence* to type it in, plus the router part (which is new). React Router is at v7 now — install `react-router-dom`, and the setup below is current for it.

---

## Phase 0 — Scaffold (5 min)

```bash
npm create vite@latest unifin -- --template react-ts
cd unifin
npm install
npm run dev
```

**Checkpoint:** default Vite page loads at `localhost:5173`. Now delete the boilerplate: empty out `App.tsx`, delete `App.css` and the logo imports. Blank screen = ready.

---

## Phase 1 — Types + fake API (10 min)

Build the data layer first, before any UI. Nothing to render, but everything depends on it.

1. Create `src/types.ts` → paste the `Transaction` / `Filter` types.
2. Create `src/api/transactions.ts` → paste the mock array + `fetchTransactions`.

**Checkpoint:** no visual change, but `npm run dev` shows **zero TypeScript errors** in the terminal. If it's red here, it'll be red everywhere — fix now.

---

## Phase 2 — Static list, no state (20 min)

Get pixels on screen with **hardcoded** data before touching `useState`. This isolates "can I render a list" from "can I manage state."

1. Create `TransactionItem.tsx` — but temporarily **delete the `onDelete` prop and the button.** Just render one row.
2. Create `TransactionList.tsx` with the `.map()`, also **without `onDelete`** for now.
3. In `App.tsx`, import `MOCK` directly and render `<TransactionList transactions={MOCK} />`.

**Checkpoint:** four rows visible, formatted euros, dates. Ugly is fine. This proves `.map()` + `key` + props-down works. **This is your first `.map()` win — stop and confirm it before adding state.**

---

## Phase 3 — Add state + loading (25 min)

Now introduce `TransactionsPage.tsx` — the brain.

1. Create it with **only** `useState` for `transactions` + `isLoading`, and the `useEffect` that calls `fetchTransactions`.
2. Add the two early-return conditionals (`isLoading`, then the list).
3. Point `App.tsx` at `<TransactionsPage />` instead of the static list.

**Checkpoint:** you see "Loading transactions…" for ~0.8s, then the four rows. That flash is `useEffect` + `useState` working together. If it loads instantly, your fake delay isn't wired. If it *never* loads, check the `[]` dep array.

---

## Phase 4 — Delete (child → parent callback) (20 min)

Now wire the upward flow.

1. Add `handleDelete` in `TransactionsPage`, pass it down through `TransactionList` into `TransactionItem`.
2. Put the `×` button back in `TransactionItem`, `onClick={() => onDelete(id)}`.

**Checkpoint:** clicking `×` removes that row. This is the whole "events flow up" model in one interaction. Deliberately test the `key` bug here: temporarily switch to `key={index}`, delete the 2nd row, watch it misbehave, then switch back. That mistake will cost you an hour someday — feel it now while it's cheap.

---

## Phase 5 — Filter (second callback) + memo (20 min)

1. Add `filter` state + `handleFilterChange` to the page.
2. Create `FilterBar.tsx`, wire `onChange` up.
3. Add the `visible` filtered array and the empty-state conditional (`length > 0 ? … : …`).
4. Create `SummaryBar.tsx` with `useMemo`.

**Checkpoint:** three filter buttons switch the list; summary totals update; filtering to an empty result shows your empty message, **not a literal `0`**. Test that on purpose.

**Ship it.** This is a complete, working transactions page — a clean stopping point if it's late. The router is a separate session's worth if you're tired.

---

## Phase 6 — Router (30 min)

Only start this once Phase 5 works. Now you add a Dashboard page and navigation.

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

## Phase 7 — Programmatic navigation (10 min, optional)

To navigate from *code* instead of a link (e.g. click a transaction → go somewhere):

```tsx
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();
// then, in a handler:
navigate('/transactions');
```

Drop a button on the Dashboard that jumps to Transactions. That's the pattern you'll use after form submits later.

---

## Mental model for the router

Three moving parts: the **route config** (`createBrowserRouter`, the URL→component map), the **layout** (`App`, holds nav + `<Outlet/>`), and the **`Outlet`** (the hole the matched child fills). `Link`/`NavLink` change the URL without reloading; the config decides what renders. Everything from Phases 1–5 is untouched — `TransactionsPage` doesn't know or care that it's now behind a route. That's the payoff of keeping state ownership clean.

---

Realistic timing: Phases 0–5 are a solid tonight (~2 hrs with debugging). If you're fried after shipping Phase 5, stop there and do the router fresh — it's cleaner in your head when you're not tired. Want a stub Dashboard that actually shows the `SummaryBar` totals (reusing that component across both routes), or keep it a placeholder for tonight?
