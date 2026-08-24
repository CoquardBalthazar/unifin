# Unifin — Bank Tracker · Development Plan

> Working document. Living plan for `unifin` (Unifin).
> Created: 2026-06-22. Last updated: 2026-08-10.
>
> **Status: Phases 1 and 2 complete.** Frontend shell, routing, tests (Vitest + RTL + Cypress),
> Docker Compose, Knex, Express CRUD, JWT auth — all shipped and tested.
> **Active target: working, deployed v1.0.0 by mid-September 2026.**
> See §5.0 for the locked scope and week-by-week schedule.

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

Five tables for v1. Designed once, never changed without a migration file.
Full column list + the reasoning behind each non-obvious column lives in **Phase 4**.

```
accounts        — id, bank, account_type, currency, label,
                  opening_balance, opening_balance_date, is_tracked

transactions    — id, date, raw_name, amount, flow, created_at            (Phase 2a)
                  account_id, import_id, source_file, imported_at         (Phase 4)
                  category_id, category_source, category_confidence,
                  category_confirmed_at                                    (Phase 4)
                  normalized_name, counterparty, external_id               (Phase 4)
                  dedupe_hash, dedupe_seq   UNIQUE(dedupe_hash, dedupe_seq)(Phase 4)
                  transfer_pair_id (self-FK, nullable)                     (Phase 4)

categories      — id, label, type (income/expense/transfer), visible
category_rules  — id, bank, match_field, match_type, pattern,
                  category_id, priority, confidence
imports         — id, account_id, filename, row_count, inserted_count,
                  skipped_count, statement_balance, statement_date, imported_at
```

**`accounts` is seeded with 7 rows, not 2** (locked 2026-08-18): BP Compte Courant · C24 Girokonto ·
C24 Pocket Food · C24 Pocket Savings · C24 Pocket Rent · Trade Republic · PayPal. Each C24 pocket
exports its own CSV, and no export carries a pocket marker — so `account_id` is chosen **per import
file** via a `--account` CLI flag, never derived from a row. `is_tracked = false` lets Trade
Republic and PayPal exist as transfer *destinations* before their parsers ship.

**`category_rules` is one table doing three jobs** (locked 2026-08-18). `match_field` selects what
`pattern` is compared against — `normalized_name` (substring), `bank_category` (C24's own
`Kategorie`), or `mcc` (Trade Republic's ISO 18245 merchant code) — and `bank` scopes a rule to one
source (`NULL` = all). `priority` *is* the policy: explicit merchant rules at 10, MCC at 50,
bank-supplied categories at 90, first hit wins. Because it is data rather than code, Phase 5's rules
screen is plain CRUD over one table.

`recurring_series` (+ `transactions.recurring_series_id`) is deliberately **not** in v1 —
it arrives with Phase 9 as its own migration.

**Four columns that exist before the feature that uses them.** They are cheap to add now
(4 lines in a migration) and expensive to retrofit later, because every query, TS type,
controller and component written between Phase 4 and Phase 10 would otherwise hardcode
their absence:

| Column | Used by | Why it can't wait |
|---|---|---|
| `category_source` (`rule`/`ai`/`manual`) | Phase 10 | Distinguishes a guess from a decision. Without it a `category_id` is just a `category_id`. |
| `category_confidence` | Phase 10 | Lets you sort "review these 12 first" |
| `category_confirmed_at` | Phase 5 + 10 | **This is the "temporary" flag.** `NULL` = the app guessed and you haven't looked. Set = you validated it. Orthogonal to `category_source` on purpose: bulk-validating an AI suggestion sets `confirmed_at` but keeps `source='ai'`, so you can measure how often the AI was right. |
| `transfer_pair_id` | Phase 6 | Links the outgoing BP row to the incoming C24 row. Not needed for *exclusion* (that's a `WHERE categories.type != 'transfer'`), but it's the only way to catch money that left one account and never arrived at the other. |
| `external_id` | Phase 4d + post-launch | The source system's own transaction id. Trade Republic ships a stable UUID, so TR dedupe is exact instead of computed. Also the join key PayPal enrichment needs. |
| `counterparty` | Phase 5 | The clean payee (`Bolt Operations OÜ`), separate from the noisy `raw_name`. What the transactions table actually displays. |

**The rules loop (revised 2026-08-18).** On import, each row is matched against `category_rules`
ordered by `priority ASC`, first hit wins. A hit sets `category_id`, `category_source = 'rule'` and
copies the rule's `confidence` onto the row — but leaves `category_confirmed_at = NULL`, because a
guess is not a decision. Manual override in the UI → `category_source = 'manual'`,
`category_confirmed_at = now()`.

**Categories — flat list, 19 rows** (locked 2026-08-18; no `parent_id`, adding one later is a 3-line
migration). Seeded from the `FOLGUNG_der_Kontos_WIP.xlsx` taxonomy:

| type | labels |
|---|---|
| `expense` | FOOD & Households · HOUSING rent · TRANSPORT · HOBBIES · HEALTH · TRIPS · STUDIES · PHONE bundle · PARTIES & Sorties · OTHERS-outflow |
| `income` | ARBEIT · BRMI · CROUS · Erasmus+ · OTHERS-inflow |
| `transfer` | SAVINGS · INVESTING · BALU · C24 pockets |

**Every transfer category must be `type = 'transfer'` or Phase 6's totals will lie.** Money moved to
Trade Republic is not consumption; counting it as expense overstates spending by whatever was saved.
`INVESTING` covers the TR cash → securities leg (Phase 4d). There is deliberately **no
`Uncategorized` row** — `category_id IS NULL` means uncategorized, and a row standing for "no row"
forces a special case into every aggregate query.

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

---

### 5.0 — v1 scope lock + schedule (set 2026-08-10)

**Target: a deployed, working app by mid-September 2026** that does what the Excel sheet does:
import bank exports from BP + C24, reject rows already imported, show both banks' transactions,
reconcile balances, categorize by hand.

#### Estimation basis — read this before trusting any number below

Measured from git history, not guessed:

| Phase | This plan's original estimate | What it actually took |
|---|---|---|
| Phase 1 (1a+1b+1c) | "1 day" | 4 active sessions (07-22 → 07-28) |
| Phase 2 (2a+2b) | "1 day (weekend)" | 3 active sessions (07-28 → 08-10) |

7 active days across 19 calendar days, one full week off.
**Original estimates ran ~3.5× optimistic.** Real cadence: 2–3 sessions/week, ~3.5h per session.

All estimates below are in **sessions (~3.5h)**, using that measured rate. The schedule needs
~3.25 sessions/week — above the historical average, achievable, **with zero slack.**
One more week off pushes v1.0.0 to end of September.

#### Phase order — note the deploy split

Phase 8 is split. **The app goes live in week 3, when it is just "login + a table of transactions."**

Three reasons, in order:
1. If week 5 runs out, there's a **live URL with a partial app** instead of a complete app on localhost. For applications that's the whole difference.
2. The first Railway deploy always bleeds (env vars, migrations against a remote DB, `DATABASE_URL` format, CORS). Debug that against 2 endpoints, not 12.
3. Phases 5 and 6 then deploy continuously — which is exactly the model the post-launch backlog (7/9/10) needs anyway.

| # | Phase | Sessions | Delivers |
|---|---|---|---|
| **3** | Skeleton hardening | 2 | `AuthContext`, `RequireAuth` + logout, `GET /health`, Vite proxy → backend |
| **4** | Schema + ETL + **duplicate detection** | ~~3.5~~ **4.25** | 4 migrations, **test DB**, accounts + categories + rules seeded, `db_insert.py` writes real BP+C24 **+ Trade Republic** rows, duplicates rejected |
| **8a** | **Deploy early** | 2 | Railway (backend + Postgres), Vercel (frontend), secrets, prod migrations → **live URL** |
| **5** | Transactions UI + manual categorization | 3 | Both banks in one table, inline category dropdown, uncategorized filter, search |
| **6** | Overview + balances + reconciliation | 4.5 | Yearly category totals, transfer exclusion, per-account balance cards, reconciliation view |
| **8b** | CI/CD + ship | 1.75 | GitHub Actions (lint → test w/ Postgres service → auto-deploy), prod smoke test, tag `v1.0.0` |
| | | **17.5** | |

**Re-scoped 2026-08-18 (+0.75).** Phase 4 grew from 3.5 to 4.25: a dedicated test database (+0.5 —
the suite currently truncates the *dev* DB, which becomes destructive the moment real rows land) and
the Trade Republic parser (+0.75 — TR is the 2026 daily card, so omitting it makes current-year
totals wrong), less 0.5 reclaimed by deferring PayPal. Week 2 absorbs it; week 3 (Railway) has no
slack, so **if a session is lost, cut Phase 4d — never 4a.**

#### Week by week

| Week | Dates | Sessions | Work |
|---|---|---|---|
| 1 | Aug 11–17 | 3.25 | Phase 3 complete (3a → 3b → 3c) · migrations M1–M4 written and run · **sample fixtures created** |
| 2 | Aug 18–24 | 3.25 | Seed accounts + categories · `db_insert.py` rewrite (normalize + hash + seq) · verify vs sample, then real · start Railway |
| 3 | Aug 25–31 | 3.25 | **Railway + Vercel live** · `GET /transactions` filtered · table rendering real data |
| 4 | Sep 1–7 | 3.5 | Inline category PATCH · uncategorized filter · search · start overview aggregation |
| 5 | Sep 8–14 | 3.5 | Balance cards · reconciliation view · transfer exclusion · Actions pipeline · smoke test · **tag `v1.0.0`** |

#### Cut from v1 — deferred, shipped later as updates to the running app

| Cut | Was in | Saves | Why it's safe |
|---|---|---|---|
| ~~`useAuth` → Context provider~~ | ~~Phase 3~~ | ~~0.75~~ | **Un-cut 2026-08-11 — the cut was based on a wrong premise.** The 2b hook is a state *factory*, not a store: every caller gets its own `useState`. With one caller (`LoginPage`) that is invisible; Phase 3 adds `<RequireAuth>` and `NavBar`, and then `markLoggedIn()` updates a copy nobody else reads. Context is the fix, not an upgrade. Cost stays ~0.75, moved into 3a. |
| CI as its own phase | Phase 3 | 1.0 | Merged into 8b, where the deploy pipeline lives anyway |
| Rules **learning-loop UI** | Phase 5 | 1.0 | The substring *matcher* stays (~15 lines of Python in the ETL) — that's the labour saver. Only the in-app "always categorize this as X" button is deferred; edit the `category_rules` table directly for now. |
| Pagination | Phase 5 | 0.5 | ~1000 rows. Send them all. |
| Drill-down (category total → rows) | Phase 6 | 0.5 | Search + category filter covers 80% of it |
| Phase 7 (mobile + import UI) | — | 5.0 | Post-launch |
| Phase 9 (recurring detection) | — | 3.0 | Post-launch |
| Phase 10 (AI categorizer) | — | 4.5 | Post-launch |

> **Do not also cut the rules matcher.** Categorizing ~1000 rows entirely by hand is a 4-hour
> clicking session that will not get finished. The existing Excel taxonomy will auto-hit 60–70%
> of rows for near-zero build cost, leaving a few hundred for manual review.

#### Known risks

1. **Phase 4 against real data is the schedule killer.** Measured 2026-08-18: the 11 BP TSV exports (ISO-8859-1, CRLF, 7-row header) hold **1484 rows / 832 distinct** — the 90-day export windows overlap, so 652 rows are re-exports. C24 is CSV, **comma**-delimited (not semicolon), UTF-8 **with BOM**. The dedupe hash has to be right or the problem surfaces at row 900. Run against `data/sample/` first.
2. **The sample fixtures exist but are unusable.** `sample_bp.tsv` is UTF-8/LF where the real export is ISO-8859-1/CRLF, so it never exercises the decode path; `sample_c24.csv` has no BOM; neither contains a within-file duplicate or an overlapping-export pair, so `dedupe_seq` and the re-import path are both untested. Rebuilt in Phase 4a via `scripts/make_fixtures.py`. Still a hard blocker for Phase 4 *and* for CI in 8b.
2b. **`dedupe_seq` is load-bearing, not theoretical.** 26 rows are duplicated *within a single* BP export — three €13.00 `BEER KING` charges on 12/03/2024, three €5.00 `DOCKLAND GMBH` credits on 02/05/2024. A hash-only unique constraint silently eats all 26.
3. **First Railway deploy may eat 2 sessions instead of 1.** Exactly why 8a sits in week 2–3 with runway behind it, not in week 5 where it would sink the date.
4. **Offline homework, week 1, no coding:** look up the real account balance on the date of the earliest imported transaction, for both BP and C24. That's `accounts.opening_balance` / `opening_balance_date`. Without it the Phase 6 reconciliation view is off by a constant and a session gets burned hunting a bug that isn't one.

---

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

Generation of the JWT_SECRET via:

```
docker compose exec app node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the result to the file below :
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

!!!
curl -X POST request is working - had to restart the docker container.

Adding tests for login page before moving on to the next pages
Valid email + valid password → 200 + { token } present.
Valid email + wrong password → 401.
Wrong/unknown email → 401.
Missing email or password in body → 400 (this is the bug you just found — write the test then confirm the fix makes it pass).
requireAuth middleware: request to /api/transactions with no Authorization header → 401; with a garbage/expired token → 401; with a valid token → passes through (200, whatever the route normally returns).
DONE
!!!

**2b done when:** `curl -X POST localhost:4000/api/auth/login -d '{"email":...,"password":...}'` returns a token, that same token in an `Authorization: Bearer` header gets you a 200 from `/api/transactions`, a missing/garbage token gets 401, and the `LoginPage` form round-trips through to a working `localStorage` token from the real browser.

**Learning outcome:** Docker Compose with a real healthcheck/depends_on chain, Knex migrations end-to-end, Express routing + middleware, bcrypt/JWT auth internals (including the timing-safety caveat), protected routes, and wiring frontend auth to a real API.

### Phase 3 — Skeleton hardening
**Layer:** Full-stack · **Stack:** React Context, React Router, Express, Knex, Vite · **Estimate:** 2 sessions · **Week 1**
**Branch:** `feature/phase3-skeleton-hardening`

*Docker Compose + Knex + the login flow already exist as of Phase 2a/2b. Repo creation and
`.gitignore` are done. CI moved to Phase 8b, where the deploy pipeline lives.*

*Scope change (2026-08-11): React Context is back in, as sub-phase 3a. The earlier cut assumed
"the existing hook works" — it does not, once more than one component calls it. See the
un-cut row in the "Cut from v1" table for the reasoning. Everything else in this phase
depends on 3a, so it goes first.*

- [ ] ~~Create repo `unifin` on GitHub~~ — **done**
- [ ] ~~`.gitignore`: `data/real/`, `backend/.env`, `frontend/.env`, `CLAUDE.local.md`~~ — **done**
- [x] **3a** — `AuthContext` + `AuthProvider`, `useAuth()` reads from it
- [x] **3b** — `<RequireAuth>` wrapper around `/` and `/transactions` · logout button in `NavBar`
- [x] **3c** — Vite dev-server proxy `/api` → `:4000` · `GET /health` with a real `SELECT 1`
- [ ] Confirm the full loop end to end: login → protected page → refresh (token survives) → logout → bounced to `/login`

**Build order is not optional here:** 3b's `<RequireAuth>` reads the shared state 3a creates.
Building 3b first produces a redirect loop that looks like a routing bug and is not one.

---

#### Phase 3a — `AuthContext`: one shared piece of auth state

**The bug this fixes**

```
Today (Phase 2b hook)                    After 3a (Context)

LoginPage    → useAuth() → useState A    LoginPage    ─┐
RequireAuth  → useAuth() → useState B    RequireAuth  ─┼→ useContext → ONE useState
NavBar       → useAuth() → useState C    NavBar       ─┘    (owned by AuthProvider)

markLoggedIn() sets A.                   markLoggedIn() sets the one state.
B and C never hear about it.             Every consumer re-renders.
```

`useAuth()` as written in 2b calls `useState` *inside itself*. A custom hook is just a
function — calling it three times runs `useState` three times and creates three independent
states. Hooks share **logic**, never **state**. Context is React's answer to "these components
need the same value": one component owns the state, everything below it in the tree reads it.

Python analogy: the 2b hook is a factory function that returns a fresh object per call.
Context is the module-level singleton everyone imports.

**Structure — new/changed files**

```
frontend/src/
├── context/
│   └── AuthContext.tsx      # new — createContext + AuthProvider (owns the state)
├── hooks/
│   └── useAuth.ts           # rewritten — useContext, no useState left
├── main.tsx                 # wraps <App/> in <AuthProvider>
└── pages/LoginPage.tsx      # unchanged — same useAuth() call, now reads shared state
```

---

##### `frontend/src/context/AuthContext.tsx` (new)

```tsx
import { createContext, useState, type ReactNode } from "react";

// The shape every consumer gets back. Exported so useAuth can type its return.
export type AuthValue = {
  isLoggedIn: boolean;
  markLoggedIn: () => void;
  markLoggedOut: () => void;
};

// createContext makes the "channel". `null` is the default, used only when a
// component reads the context with no Provider above it — which is a bug, so
// useAuth throws on it rather than silently returning a broken default.
export const AuthContext = createContext<AuthValue | null>(null);

// The Provider component OWNS the state. This is the only useState for auth
// in the whole app — the exact line that was duplicated per-caller before.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => !!localStorage.getItem("token"),
  );

  function markLoggedIn() {
    setIsLoggedIn(true);
  }

  function markLoggedOut() {
    localStorage.removeItem("token");
    setIsLoggedIn(false);
  }

  return (
    <AuthContext value={{ isLoggedIn, markLoggedIn, markLoggedOut }}>
      {children}
    </AuthContext>
  );
}
```

Three things worth internalizing:

1. **`useState(() => ...)` — the lazy initializer.** The arrow function form runs
   `localStorage.getItem` *once*, on first render only. `useState(!!localStorage.getItem(...))`
   without the arrow reads localStorage on every single render and throws the result away.
   Carried over from 2b; still correct.
2. **`children` + `ReactNode`.** `AuthProvider` wraps arbitrary JSX, so its `children` prop
   is typed `ReactNode` — the "anything React can render" type already in your concept box.
3. **`<AuthContext value={...}>` with no `.Provider`.** React 19 (you're on 19.2) lets the
   context object be used directly as the provider component. Every tutorial written before
   2024 says `<AuthContext.Provider value={...}>` — that still works, it's the old spelling
   of the same thing.

---

##### `frontend/src/hooks/useAuth.ts` (rewritten)

```ts
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

// No useState here anymore. This hook is now a thin, typed reader of the
// single state owned by AuthProvider.
export function useAuth() {
  const value = useContext(AuthContext);

  // Guard: reading the context outside <AuthProvider> returns the `null`
  // default. Without this throw you'd get "cannot destructure property
  // 'isLoggedIn' of null" somewhere deep in a component — this fails loudly
  // at the actual cause instead.
  if (!value) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }

  return value;
}
```

The call sites do not change — `const { markLoggedIn } = useAuth();` in `LoginPage` still reads
identically. That's the point of keeping the hook as the public API instead of having components
call `useContext(AuthContext)` directly: the storage mechanism swapped underneath and nothing else
had to be touched.

---

##### `frontend/src/main.tsx` (updated)

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "./styles/index.css";
import App from "./App.tsx";
import { AuthProvider } from "./context/AuthContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
```

`AuthProvider` goes **outside** `BrowserRouter`: auth state is not route-specific, and this
ordering means a future `<RequireAuth>` anywhere in the route tree is guaranteed to have a
provider above it. Anything *inside* the provider can call `useAuth()`; anything outside cannot.

---

##### `frontend/src/context/AuthContext.test.tsx` (new)

The one test that would have caught the original bug — two separate components reading the same
state:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider } from "./AuthContext";
import { useAuth } from "../hooks/useAuth";

function Reader() {
  const { isLoggedIn } = useAuth();
  return <span>{isLoggedIn ? "in" : "out"}</span>;
}

function Toggler() {
  const { markLoggedIn } = useAuth();
  return <button onClick={markLoggedIn}>log in</button>;
}

test("state set by one consumer is visible to another", async () => {
  render(
    <AuthProvider>
      <Reader />
      <Toggler />
    </AuthProvider>,
  );

  expect(screen.getByText("out")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /log in/i }));
  expect(screen.getByText("in")).toBeInTheDocument();   // ← fails against the 2b hook
});
```

Run this against the old `useAuth` and it fails on the last line: `Toggler` sets its own copy,
`Reader` still renders "out". That failure *is* the justification for this sub-phase.

**3a done when:** the test above passes, `npm run dev` still logs in from `LoginPage`, and
`grep -rn "useState" src/hooks/useAuth.ts` returns nothing.

---

#### Phase 3b — `<RequireAuth>` + logout

**What it produces**

```
Browser hits /transactions
        │
        ▼
   <RequireAuth>  ← reads useAuth().isLoggedIn (the shared one, from 3a)
        │
   logged in?──no──▶ <Navigate to="/login" replace />
        │yes
        ▼
   <Outlet/> → TransactionPage renders

NavBar "Log out" → markLoggedOut() → localStorage cleared + state false
        │
        ▼
   RequireAuth re-renders, now false → bounced to /login (no navigate() call needed)
```

The redirect on logout is a *consequence* of the state change, not an explicit
`navigate("/login")`. That's the declarative-routing mindset: you change state, and the route
tree re-renders to match. This is the pattern CREA inherits verbatim.

**Structure — new/changed files**

```
frontend/src/
├── core/
│   ├── RequireAuth.tsx      # new — the guard
│   ├── RequireAuth.test.tsx # new
│   ├── NavBar.tsx           # + logout button, hidden when logged out
│   └── NavBar.test.tsx      # + logout cases
└── App.tsx                  # routes regrouped under the guard
```

---

##### `frontend/src/core/RequireAuth.tsx` (new)

```tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

// A "layout route" component: it renders nothing of its own, it either
// renders its matched child route (<Outlet/>) or redirects.
export function RequireAuth() {
  const { isLoggedIn } = useAuth();

  // `replace` swaps the current history entry instead of pushing a new one.
  // Without it, the browser Back button sends you to the protected URL you
  // were just bounced off — which immediately bounces you again. Back button
  // becomes useless.
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
```

`<Outlet />` is the same slot concept already in your concept box from Phase 1's routing work —
here the layout component happens to have a condition in front of it. `<Navigate>` is the
component form of `useNavigate()`: use the component when redirecting *during render*, the hook
when redirecting *inside a handler* (as `LoginPage` does).

---

##### `frontend/src/App.tsx` (updated)

```tsx
import "./App.css";
import { Routes, Route } from "react-router-dom";
import { NavBar } from "./core/NavBar";
import { RequireAuth } from "./core/RequireAuth";

import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { TransactionPage } from "./features/transactions/TransactionPage";

function App() {
  return (
    <div>
      <NavBar />
      <Routes>
        {/* public */}
        <Route path="/login" element={<LoginPage />} />

        {/* protected — a pathless parent route: it adds no URL segment,
            it only wraps its children in the guard. Add future protected
            routes here and they are covered for free. */}
        <Route element={<RequireAuth />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/transactions" element={<TransactionPage />} />
        </Route>
      </Routes>
    </div>
  );
}

export default App;
```

The **pathless route** (`<Route>` with `element` but no `path`) is the piece worth learning: it
groups children under shared behaviour without touching the URLs. The alternative —
`<RequireAuth><DashboardPage /></RequireAuth>` repeated per route — works but you must remember
it on every new route, and one forgotten wrapper is an unprotected page.

---

##### `frontend/src/core/NavBar.tsx` (updated)

```tsx
// src/core/NavBar.tsx
import { NavLink } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? "font-bold underline text-white"
    : "opacity-70 text-white hover:opacity-100";

export function NavBar() {
  const { isLoggedIn, markLoggedOut } = useAuth();

  return (
    <nav className="flex gap-4 p-4 bg-slate-800">
      <NavLink to="/" end className={linkClass}>
        Home
      </NavLink>
      <NavLink to="/transactions" className={linkClass}>
        Transactions
      </NavLink>

      {/* ml-auto pushes this to the far right of the flex row — the Tailwind
          idiom for "space between these and the rest", no float, no justify
          juggling on the parent. */}
      {isLoggedIn && (
        <button
          onClick={markLoggedOut}
          className="ml-auto text-white opacity-70 hover:opacity-100"
        >
          Log out
        </button>
      )}
    </nav>
  );
}
```

`{isLoggedIn && <button/>}` is safe here because `isLoggedIn` is a real boolean — `false` renders
nothing. The concept-box warning about `&&` applies to *numbers* (`array.length && ...` renders a
literal `0`), not booleans.

Open question to decide while building: `NavBar` currently sits outside `<Routes>`, so it also
renders on `/login` — showing Home/Transactions links to someone who is not logged in. Clicking
one just bounces them back to `/login`, so it is not a security hole, only sloppy. Cheapest fix is
wrapping the two `NavLink`s in the same `isLoggedIn &&`. Decide when you see it in the browser.

---

##### `frontend/src/core/RequireAuth.test.tsx` (new)

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext";
import { RequireAuth } from "./RequireAuth";

// MemoryRouter instead of BrowserRouter: keeps history in memory, and
// `initialEntries` lets a test start on any URL without touching jsdom's
// address bar. The standard router-testing tool.
function renderAt(path: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<p>login page</p>} />
          <Route element={<RequireAuth />}>
            <Route path="/transactions" element={<p>secret transactions</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

beforeEach(() => localStorage.clear());

test("redirects to /login when no token", () => {
  renderAt("/transactions");
  expect(screen.getByText("login page")).toBeInTheDocument();
});

test("renders the protected route when a token exists", () => {
  localStorage.setItem("token", "fake.jwt.token");   // AuthProvider reads this on mount
  renderAt("/transactions");
  expect(screen.getByText("secret transactions")).toBeInTheDocument();
});
```

Note what is *not* tested: whether the token is valid. That is the backend's job
(`requireAuth` middleware, already tested in 2b). The frontend guard only answers "is there a
token" — a forged localStorage entry gets you a rendered page whose every API call returns 401.
Frontend guards are UX, not security. Worth being explicit about, because it is a common
interview question and a common junior mistake.

**3b done when:** logged out, `/transactions` in the address bar lands on `/login`; after login it
renders; the logout button clears the token and bounces you back; both tests pass.

---

#### Phase 3c — Vite `/api` proxy + a healthcheck that means something

**What it produces**

```
DEV (two servers, one origin as far as the browser is concerned)

  browser :5173 ──fetch('/api/transactions')──▶ Vite dev server :5173
                                                      │ proxy rule
                                                      ▼
                                                Express :4000
Same origin → no CORS preflight, no CORS config in Express, and the
relative fetch() paths already written in api/auth.ts work unchanged.

GET /health  (no auth — Railway and CI must reach it without a token)
      │
      ▼
  SELECT 1  ──▶ ok    → 200 { status: 'ok', db: 'ok' }
            ──▶ throw → 503 { status: 'ok', db: 'down' }
```

Why a `SELECT 1` and not `res.json({status:'ok'})`: a healthcheck that only proves Node is alive
will report green while Postgres is unreachable and every real request 500s. Railway would keep
routing traffic to a dead instance. The DB round-trip is the whole point.

**Structure — new/changed files**

```
frontend/
└── vite.config.ts               # + server.proxy
backend/src/
├── routes/health.ts             # new
├── controllers/health.ts        # new
├── routes/health.test.ts        # new
└── index.ts                     # mounts /health BEFORE requireAuth
```

---

##### `frontend/vite.config.ts` (updated)

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Any request the dev server receives starting with /api is forwarded
      // to Express. The browser only ever talks to :5173, so it never sees a
      // cross-origin request and never sends a CORS preflight.
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,   // rewrites the Host header to the target — matters
                              // the moment the backend is behind a proxy/vhost
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/setupTests.ts",
  },
});
```

Dev-only — this config does not exist in production, where Vercel serves the built frontend and
`/api` must point at the Railway URL via `VITE_API_URL`. That switch is Phase 8a's problem; note
it now so it is not a surprise then.

`4000` is the port Express binds on your **host** (published by Compose as `4000:4000`). The
Vite dev server runs on the host too, so `localhost:4000` is correct here — the `postgres`-style
service-name addressing only applies *between* containers.

---

##### `backend/src/controllers/health.ts` (new)

```ts
import type { Request, Response } from "express";
import { db } from "../db/knex.js";

export async function health(req: Request, res: Response) {
  try {
    await db.raw("SELECT 1");                      // cheapest possible real round-trip
    res.json({ status: "ok", db: "ok" });
  } catch {
    // 503 Service Unavailable, not 500: the app is fine, a dependency is not.
    // Railway's healthcheck treats any non-2xx as unhealthy and stops routing.
    res.status(503).json({ status: "ok", db: "down" });
  }
}
```

`db.raw()` is Knex's escape hatch for SQL the query builder cannot express. `SELECT 1` returns one
row of one constant — it touches no table, so it stays valid no matter how the schema changes in
Phase 4.

Deliberate choice: this controller talks to `db` directly instead of going through a service.
The service layer exists to keep business logic testable without HTTP — there is no business logic
here, so a `services/health.ts` wrapping one `db.raw` would be ceremony. Note it as a conscious
exception to the layering rule, not an oversight.

---

##### `backend/src/routes/health.ts` (new)

```ts
import { Router } from "express";
import * as controller from "../controllers/health.js";

export const healthRouter = Router();
healthRouter.get("/", controller.health);
```

---

##### `backend/src/index.ts` (updated — insertion point matters)

```ts
app.use(express.json());

app.use("/health", healthRouter);   // ← public, and mounted at /health not /api/health:
                                    //   Railway's healthcheck path convention, and it keeps
                                    //   the "everything under /api is app data" rule clean
app.use("/api/auth", authRouter);                              // public
app.use("/api/transactions", requireAuth, transactionsRouter); // protected
```

No auth on `/health` — Railway's health prober and GitHub Actions have no token. It leaks exactly
one bit ("the DB is up"), which is the intended purpose.

---

##### `backend/src/routes/health.test.ts` (new)

```ts
import request from "supertest";
import { app } from "../index.js";
import { db } from "../db/knex.js";

afterAll(async () => {
  await db.destroy();
});

test("GET /health returns 200 with db ok", async () => {
  const res = await request(app).get("/health");
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: "ok", db: "ok" });
});

test("GET /health needs no Authorization header", async () => {
  const res = await request(app).get("/health");
  expect(res.status).not.toBe(401);
});
```

The `db: "down"` branch is not unit-tested — faking a dead pool costs more than it returns. You
verify it once by hand: `docker compose stop postgres`, `curl -i localhost:4000/health`, expect
503, then `docker compose start postgres`.

**3c done when:** `curl localhost:4000/health` returns `{"status":"ok","db":"ok"}`, the same
endpoint returns 503 with Postgres stopped, and `LoginPage` logs in from the Vite dev server on
`:5173` with no CORS error in the console.

---

**Phase 3 done when:** the full loop runs in a real browser — log in → land on `/` → hard-refresh
and stay logged in (token survives in `localStorage`) → click Log out → bounced to `/login` →
typing `/transactions` in the address bar bounces you again. Plus: 3a, 3b and 3c test files green.

**Learning outcome:** why a custom hook shares logic but not state, `createContext` /
Provider / `useContext` as the fix, the pathless-route guard pattern, `<Navigate replace>` vs
`useNavigate()`, dev-server proxying as the no-CORS answer, and a healthcheck that proves the
dependency rather than the process. All five carry straight into CREA.

### Phase 4 — Database schema + ETL + duplicate detection
**Layer:** Backend · **Stack:** Knex migrations, PostgreSQL, Python, Vitest · **Estimate:** 4.25 sessions · **Weeks 1–2**

*The real schema lands here, and the Python ETL starts writing to Postgres with duplicate
rejection. This is the highest-risk phase in the plan — see §5.0 risk 1.*

#### Decisions locked 2026-08-18

| Decision | Choice | Reason |
|---|---|---|
| Test isolation | Second **database** (`db-unifin-test`) in the existing `postgres` container | Zero extra RAM, one healthcheck. Everything reads `DATABASE_URL_TEST`, so switching to a dedicated `postgres-test` service later is an env-var change + 8 lines of Compose |
| Category shape | **Flat** list, no `parent_id` | Phase 6 totals stay one `GROUP BY`. Adding `parent_id` later is a 3-line migration; flattening a hierarchy is not |
| Savings / investments | `type = 'transfer'` | Money invested is not consumption. Counting it as expense makes the yearly total lie by whatever you saved |
| Bank-provided categories | Fallback **after** rules, via `priority` | C24 ships `Kategorie` on every row and TR ships `mcc_code`. Free coverage; explicit rules still win |
| Rules storage | **One** `category_rules` table with `bank` + `match_field` | Three behaviours (name substring, bank category, MCC), one matching loop, one CRUD screen in Phase 5 |
| C24 pockets | Separate accounts (Girokonto + Food + Savings + Rent) | Each pocket exports its own CSV. The rows carry no pocket marker, so `account_id` is chosen **per import file**, not per row |
| Trade Republic | Full account, **Phase 4d** | It is the 2026 daily card (`ALDI SUED`, `REWE`, `SNCF`). Excluding it makes current-year totals wrong |
| TR `BUY` / `SELL` | Cash side only, category `INVESTING` (`type = 'transfer'`) | The TR cash balance reconciles; expense totals stay clean; no portfolio tracking scope creep |
| PayPal | **Not** an account in v1 — deferred as an *enricher* | Importing it counts every purchase 2–3× (payment row + funding row + the card charge already in BP). See 4e note |
| Multi-user | Not prepared for | The work is `WHERE user_id = ?` on every query, not the column. A dead nullable column saves nothing |

#### Revised estimate: 3.5 → 4.25 sessions

| Added | Cost | Why it's not optional |
|---|---|---|
| Test DB + fixtures (4a) | +0.5 | Today `transactions.test.ts` truncates the **dev** DB. The first `npm test` after a real import deletes 832 rows |
| Trade Republic (4d) | +0.75 | Third parser, but it is where 2026 spending lives |
| PayPal deferred | −0.5 | Reclaimed from the original scope |

Week 2 has the slack for this. Week 3 (Railway) does not — so if a session is lost, **cut 4d, not 4a.**

#### Sub-phases

| # | Delivers | Sessions | Stop-and-confirm point |
|---|---|---|---|
| **4a** | Test DB + sample fixtures | 0.75 | `npm test` runs against `db-unifin-test`; dev DB row count unchanged |
| **4b** | Migrations M1–M4 + seeds | 1.0 | `migrate:latest` → `rollback` → `latest` clean; seeds idempotent |
| **4c** | `db_insert.py` — BP + C24, dedupe, rules | 1.25 | Same file imported twice → `inserted_count = 0` the second time |
| **4d** | Trade Republic parser + MCC rules | 0.75 | TR rows import; UUID dedupe; `BUY` rows land as transfers |
| **4e** | Real data + reconciliation | 0.5 | 832 BP rows in, counts match, re-import of an overlapping export skips correctly |

---

#### Phase 4a — Test database + sample fixtures
**0.75 session** · *Do this first. Every later step needs somewhere safe to fail.*

##### Why this is step one

[transactions.test.ts:39](backend/src/routes/transactions.test.ts#L39) currently calls
`db("transactions").truncate()` against **`DATABASE_URL`** — the dev database. That is harmless
today (the table is empty) and catastrophic on 2026-08-25, when it holds 832 imported rows and
you run `npm test` out of habit. It also breaks outright the moment M3/M4 add foreign keys:
plain `TRUNCATE` on a table referenced by `imports` throws.

##### Files

```
docker/pg-init/01-create-test-db.sql        NEW
docker-compose.yml                           EDIT   mount pg-init
backend/.env                                 EDIT   ❌ gitignored
backend/.env.example                         EDIT   ✅ committed
backend/vitest.config.ts                     NEW
backend/test/globalSetup.ts                  NEW
backend/test/helpers/db.ts                   NEW
backend/src/routes/transactions.test.ts      EDIT   use the helper
scripts/make_fixtures.py                     NEW
data/sample/sample_bp.tsv                    FIX    wrong encoding today
data/sample/sample_bp_overlap.tsv            NEW
data/sample/sample_c24.csv                   FIX    missing BOM today
data/sample/sample_c24_overlap.csv           NEW
data/sample/sample_tr.csv                    NEW    used in 4d
data/sample/README.md                        NEW
```

---

##### Step 4a.1 — Create the second database

`docker/pg-init/01-create-test-db.sql`:

```sql
-- Runs once, only when the postgres_data volume is initialised empty.
CREATE DATABASE "db-unifin-test" OWNER "u-unifin";
```

`docker-compose.yml` — add one line to the `postgres` service:

```yaml
  postgres:
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/pg-init:/docker-entrypoint-initdb.d:ro    # ← new
```

- `./docker/pg-init` — host directory holding the SQL.
- `:/docker-entrypoint-initdb.d` — the path the official `postgres` image scans on first boot; every `.sql` / `.sh` in it runs in filename order.
- `:ro` — mounted read-only. The container has no business writing to your repo.

**The gotcha that will cost you 20 minutes if you skip it:** `docker-entrypoint-initdb.d` only
runs when the data directory is **empty**. Your `postgres_data` volume already exists, so
mounting the script changes nothing by itself. Pick one:

```bash
docker compose down -v
```
- `down` — stop and remove containers + networks.
- `-v` — **also delete named volumes.** This wipes `db-unifin`. Safe right now (Phase 2 scratch data only); never run it after 4e.

or create it by hand once and keep the script for future clean boots:

```bash
docker compose exec postgres psql -U u-unifin -d db-unifin -c 'CREATE DATABASE "db-unifin-test" OWNER "u-unifin";'
```
- `exec postgres` — run inside the **already running** `postgres` container (`run` would start a second one).
- `psql -U u-unifin` — connect as that role.
- `-d db-unifin` — connect to an existing database; you cannot `CREATE DATABASE` while connected to the one being created.
- `-c '…'` — execute one statement and exit.

**DoD 4a.1**
```bash
docker compose exec postgres psql -U u-unifin -l
```
`-l` lists databases. Both `db-unifin` and `db-unifin-test` appear, owner `u-unifin`.

---

##### Step 4a.2 — Point Vitest at the test database

`backend/.env` (and the same two keys, placeholder values, in `.env.example`):

```bash
DATABASE_URL=postgres://u-unifin:pw-unifin@postgres:5432/db-unifin
DATABASE_URL_TEST=postgres://u-unifin:pw-unifin@postgres:5432/db-unifin-test
```

`backend/vitest.config.ts` — **new file**, Vitest currently runs on defaults:

```ts
import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

// This config file is evaluated in Node before any test worker spawns —
// the only place we can read .env and swap the DB URL *before*
// src/db/knex.ts is imported anywhere.
dotenv.config();

export default defineConfig({
  test: {
    // Injected into process.env inside each worker, before module load.
    env: {
      DATABASE_URL: process.env.DATABASE_URL_TEST!,
      NODE_ENV: "test",
    },
    globalSetup: "./test/globalSetup.ts",
    // One shared database. With parallelism on, two files would
    // TRUNCATE each other's fixtures mid-assertion.
    fileParallelism: false,
  },
});
```

**Why a `beforeAll` would not work here.** `src/db/knex.ts` reads `process.env.DATABASE_URL` at
*module load time*, and `src/index.ts` does `import "dotenv/config"` on its first line. By the
time any `beforeAll` runs, the pool is already pointed at the dev DB. `test.env` lands before
both — and **`dotenv` never overwrites an already-set variable** (concept box, Phase 3c), so
`.env` cannot clobber the injected value. That property is doing the load-bearing work.

`backend/test/globalSetup.ts`:

```ts
import knex from "knex";
import config from "../knexfile.js";

// Runs ONCE per `npm test`, before the first test file.
// Migrating here means every test run also exercises M1–M4 —
// free coverage on the riskiest code in this phase.
export async function setup() {
  const db = knex({ ...config, connection: process.env.DATABASE_URL_TEST! });
  await db.migrate.latest();
  await db.seed.run();          // accounts, categories, category_rules (4b)
  await db.destroy();
}
```

`backend/test/helpers/db.ts`:

```ts
import { db } from "../../src/db/knex.js";

// Wipes transactional data between tests; keeps reference seeds.
//   CASCADE         — required: imports.account_id and the
//                     transactions.transfer_pair_id self-FK both
//                     make a bare TRUNCATE throw.
//   RESTART IDENTITY— resets id sequences so tests can assert on id = 1.
export function truncateTransactional() {
  return db.raw("TRUNCATE transactions, imports RESTART IDENTITY CASCADE");
}
```

Then edit [transactions.test.ts:39](backend/src/routes/transactions.test.ts#L39):

```diff
- await db("transactions").truncate();
+ await truncateTransactional();
```

and delete the `// NOTES : Change the db to test-db when in production` comment above it — it is
now done.

**Test to add** — `backend/test/isolation.test.ts`. This is the one test that proves 4a worked:

```ts
import { describe, test, expect, afterAll } from "vitest";
import { db } from "../src/db/knex.js";

afterAll(async () => { await db.destroy(); });

describe("test database isolation", () => {
  test("the suite is connected to db-unifin-test, not db-unifin", async () => {
    const { rows } = await db.raw("SELECT current_database() AS name");
    expect(rows[0].name).toBe("db-unifin-test");
  });

  test("reference seeds are present", async () => {
    const [{ count }] = await db("categories").count();
    expect(Number(count)).toBeGreaterThan(0);
  });
});
```

The first assertion is the entire point of this sub-phase. If it ever goes red, stop.

**DoD 4a.2**
1. `docker compose exec app npm test` — all green, including `isolation.test.ts`.
2. Insert a marker row into the **dev** DB, run the suite, confirm it survives:
```bash
docker compose exec postgres psql -U u-unifin -d db-unifin -c "INSERT INTO transactions (date, raw_name, amount, flow) VALUES ('2026-01-01','CANARY',-1,'expense');"
docker compose exec app npm test
docker compose exec postgres psql -U u-unifin -d db-unifin -c "SELECT count(*) FROM transactions;"
```
The count must still be 1. If it is 0, the env swap did not take.

---

##### Step 4a.3 — Sample fixtures

Two different things, do not conflate them:

- **`data/sample/*`** — fake bank *export files*, fed to the Python ETL. Test the **parser**.
- **`backend/test/*`** — rows inserted straight into Postgres. Test the **API**.
Current state of `data/sample/` — the files exist but are not usable as fixtures:

| | Real export | `data/sample/` today | |
|---|---|---|---|
| BP encoding | ISO-8859-1, CRLF | UTF-8, LF | ✗ never exercises `encoding="ISO-8859-1"` in [bp.py:39](backend/python/bank/bp.py#L39) |
| C24 encoding | UTF-8 **with BOM** | no BOM | ✗ BOM bugs cannot surface |
| Within-file duplicates | 26 across the BP exports | 0 | ✗ `dedupe_seq` untested |
| Overlapping export | 464 shared rows across files | none | ✗ re-import path untested |

###### Formats VERIFIED against real exports 2026-08-24 — this table wins over anything below

Measured from `data/real/temp/20260824/` (gitignored). Earlier claims in this plan about C24
line endings and the Trade Republic format were **wrong**; corrected here.

| | v1 file | Encoding | Line ends | Delimiter | Decimal | Dates | Cols |
|---|---|---|---|---|---|---|---|
| **BP** | `BP_TSV_*.tsv` | ISO-8859-1 | **CRLF** | tab | `,` | `DD/MM/YYYY` | 3 |
| **C24** | `C24_*_Transaktionen.csv` | UTF-8 **+ BOM** | **LF** ← *not CRLF* | `,` | `,` | `DD.MM.YYYY` | **14** |
| **TR** | `TR_transactions_*.csv` | UTF-8, no BOM | **LF** | `,`, **every field quoted** | `.` (6 dp) | ISO `YYYY-MM-DD` | 23 |

**BP specifics**
- Header block is exactly 7 lines; padding is verbatim and must not be tidied:
  `Compte tenu en··`, `Date············`, `Solde (EUROS)···` (`·` = space).
- Account number shape `#######S###`.
- Card rows pad the number with **16 spaces**: `CARTE NUMERO                111  ` (2 trailing).
- Credits carry **no `+`** — bare `2200,00`. No footer row; the last line is a data row.
- Body row = `date \t "libellé" \t amount`; only the libellé is quoted.

**C24 specifics**
- 14 columns: `Transaktionstyp, Buchungsdatum, Karteneinsatz, Betrag, Zahlungsempfänger, IBAN,
  BIC, Verwendungszweck, Beschreibung, Kontonummer, Kontoname, Kategorie, Unterkategorie,
  Bargeldabhebung`. The current sample has 10 — missing `Karteneinsatz`, `Kontonummer`,
  `Kontoname`, `Bargeldabhebung`.
- **`Betrag` carries the currency symbol**: `"-123,45 €"`. This breaks
  [c24.py:34](backend/python/bank/c24.py#L34) — `.str.replace(",", ".").astype(float)` raises
  `ValueError` on `-123.45 €`. Strip `€` and NBSP before the comma swap (4c).
- `c24.py` also hardcodes `delimiter=","` and passes no `encoding` — see the backlog item below.
- `Karteneinsatz` is a card-usage timestamp `DD.MM.YYYY HH:MM`, distinct from `Buchungsdatum`.

**TR specifics**
- 23 columns; `transaction_id` is a **UUID** → a real `external_id`, so dedupe needs no hash.
- `mcc_code` is the last column and is populated (`4112` = rail).
- Amounts are 6-decimal (`-15.100000`) — `f"{amount:.2f}"` at the hash boundary matters here.

**Correction to a locked decision.** The 4a table states C24 rows carry no pocket marker. They
do: **`Kontoname`** (`Food`, `C24 Smartkonto`). `--account` per import file stays the v1 design
(simpler, and it is the DoD), but 4c must **assert every row in a file shares one `Kontoname`**
and fail loudly on mismatch. Without that, importing the Food pocket under `--account girokonto`
is silent and permanently poisons Phase 6 totals.

###### Required rows — `sample_bp.tsv`

Header block is **exactly 7 lines** (5 meta + 1 blank + 1 column header), because `bp.py`
hardcodes `skiprows=7`. Body must contain one of each:

| # | Row | Proves |
|---|---|---|
| a | `ACHAT CB SAMPLE MARKET 12.03.26 EUR    45,20 CARTE NO  111  ` | normalizer strips padding, dates, card numbers |
| b | **3 byte-identical rows** (same date, Libellé, amount) | `dedupe_seq` → 0, 1, 2 — models the real `BEER KING ×3` |
| c | 2 rows, same date + amount, **different** Libellé | hash includes the name; both must insert |
| d | `VIREMENT SALAIRE SAMPLE EMPLOYER SA` `+2200,00` | `flow = income`, rule → `ARBEIT` |
| e | `VIREMENT INSTANTANE A SAMPLE PERSON` | transfer pairing, Phase 6 |
| f | `ACHAT CB CAFÉ DES ARTS …` | **the ISO-8859-1 canary** — wrong encoding renders `CAFÃ‰` and fails loudly instead of silently |
| g | `ACHAT CB PAYPAL  SAMPLE 01.03.26 CARTE NUMERO   111  ` | the 9.3% of BP rows PayPal enrichment will later fix |

###### `sample_bp_overlap.tsv`

Same header block, different `Date` / `Solde`. Body = the newest **5 rows of `sample_bp.tsv`,
byte-identical** + **3 new rows** dated later. Importing it second must yield
`inserted_count = 3, skipped_count = 5`. That single assertion is the Definition of Done for the
whole dedupe design.

###### `sample_c24.csv`

UTF-8 **with BOM**, **LF** line endings, comma-delimited, all **14** columns in the order listed
in the verified-formats table above. Amounts are quoted German-style **including the currency
symbol**: `"-37,99 €"`. Must contain: a `Verwendungszweck` of ~95 chars (the real maximum —
catches truncation), an `Einkommen / Lohn/ Gehalt` row, a `Geldanlage / Kapitalanlage` row, a
`Bargeldabhebung`, one within-file duplicate pair, one row with an **empty** `Verwendungszweck`
(exercises the `rstrip("_")` in [c24.py:59](backend/python/bank/c24.py#L59)), and a consistent
`Kontoname` on every row (so the 4c per-file assertion has something to pass against).

###### `sample_tr.csv`

**Comma**-delimited with **every field quoted**, **ISO `YYYY-MM-DD`** dates, `.` decimal with
**6 decimal places**, LF, no BOM, 23 columns. Needs one row of each `type` the parser branches
on: `CARD_TRANSACTION` (with an `mcc_code`), `TRANSFER_INSTANT_INBOUND`, `BUY` (with a non-zero
`fee`), `CARD_ORDERING_FEE` — each with a distinct UUID `transaction_id`. Used in 4d.

###### How to build them

Hand-typing ISO-8859-1 + CRLF in an editor is a coin flip. Write a generator instead —
`scripts/make_fixtures.py`, one function per bank:

```python
BP_ROWS = [...]  # (date, libelle, amount) tuples — the a–g table above

with open("data/sample/sample_bp.tsv", "w",
          encoding="ISO-8859-1",   # ← the whole point
          newline="\r\n") as f:    # ← CRLF, matching the real export
    ...

with open("data/sample/sample_c24.csv", "w",
          encoding="utf-8-sig",    # ← "-sig" writes the BOM
          newline="\n") as f:      # ← LF. C24 is NOT CRLF — verified 2026-08-24
    ...

with open("data/sample/sample_tr.csv", "w",
          encoding="utf-8",        # ← no BOM here
          newline="\n") as f:
    ...
```

`newline=` is what Python translates every `"\n"` into on write. Left at the default (`None`) it
uses `os.linesep` — LF on WSL — which silently produces the wrong BP fixture. Setting it
explicitly is what makes the bytes reproducible in CI.

**DoD 4a.3**
```bash
python3 scripts/make_fixtures.py && file data/sample/*
```
- `file` — reads magic bytes and reports the detected encoding.
- Required output: `sample_bp.tsv: ISO-8859 text, with CRLF line terminators`.
  If it says `UTF-8`, the fixture is worthless — regenerate.

Confirm the C24 BOM separately:
```bash
head -c 3 data/sample/sample_c24.csv | xxd
```
- `head -c 3` — first 3 bytes only.
- `xxd` — hex dump. Must read `efbb bf`.

`data/sample/README.md` records what each row proves, so nobody deletes the weird-looking
triplicate rows in six months thinking they are a mistake.

**4a done when:** `npm test` is green, connected to `db-unifin-test`, the dev-DB canary row
survives a full test run, and `file --mime-encoding data/sample/*` reports the right encodings
(`iso-8859-1` / `utf-8` / `utf-8`). Use `--mime-encoding`, not bare `file`: `file` runs a
structural test first and reports `CSV text` for a well-formed CSV without naming the encoding.

---

#### Phase 4a-bis — Working environment (added 2026-08-24)
*Not a build phase. Two housekeeping items that make 4b–4e less painful, done between 4a and 4b.*

##### pgAdmin as an opt-in Compose service

A GUI on the database pays for itself the moment migrations exist: inspecting a foreign key or a
`dedupe_seq` distribution in a table view beats writing `psql` one-liners. It is added **now**
rather than later because the same tool connects to Railway in 8a — one tree holding dev, test
and prod.

`docker/pgadmin/servers.json` (committed, **no passwords**) pre-registers `db-unifin` and
`db-unifin-test`. In `docker-compose.yml`:

```yaml
  pgadmin:
    image: dpage/pgadmin4:8
    profiles: ["tools"]          # skipped by a bare `docker compose up`
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@example.com         # see gotcha 1 below
      PGADMIN_DEFAULT_PASSWORD: pw-unifin
      PGADMIN_CONFIG_SERVER_MODE: "False"              # desktop mode, no login screen
      PGADMIN_CONFIG_MASTER_PASSWORD_REQUIRED: "False"
    ports:
      - "5050:80"
    volumes:
      - pgadmin_data:/var/lib/pgadmin
      - ./docker/pgadmin/servers.json:/pgadmin4/servers.json:ro
    depends_on:
      postgres:
        condition: service_healthy
```

```bash
docker compose --profile tools up -d pgadmin    # http://localhost:5050
docker compose --profile tools stop pgadmin
```

- **`profiles:`** — a service in a profile is skipped unless the profile is named. Normal startup
  stays two containers; the GUI is opt-in. This is the general pattern for optional dev tooling.
- **`pgadmin_data`** — pgAdmin's own config DB (saved passwords, query history, layout). Without
  it, every `down` loses the registrations.
- **`servers.json` imports only on first boot**, while `pgadmin_data` is empty — the same rule as
  `/docker-entrypoint-initdb.d` and `postgres_data`. To re-import after editing:
  `docker volume rm unifin_pgadmin_data` (**not** `down -v`, which wipes the database too).
- **Inside pgAdmin the host is `postgres`**, not `localhost` — it is a container on the Compose
  network. A host GUI (DBeaver, SQLTools) uses `localhost:5432`. Same DB, two names.

###### Gotchas hit while setting this up

**1. `PGADMIN_DEFAULT_EMAIL` must pass pgAdmin's email validator.** `dev@unifin.local` is
*rejected* — `.local` is a reserved TLD — and the container exits on boot:

```
'dev@unifin.local' does not appear to be a valid email address.
```

The address is never used in desktop mode, but it is still validated. Use a real-looking domain.

**2. `restart: unless-stopped` turns a fatal config error into an infinite retry.** The symptom is
not an error, it is *nothing*: no port, no response, no `Listening at:` line. The tell is
`docker compose ps`:

```
pgadmin    Restarting (1) 8 seconds ago      ← empty PORTS column
```

**An empty `PORTS` column always means the container never reached running state**, whatever the
status text says — the process died before it could bind, so Docker never published `5050`. Same
family as the Phase 3c crash-loop, but the opposite surface: there the port stayed *held* by a
stale `docker-proxy`, here it was never published at all. Either way the answer is
`docker compose logs <service>` — the error is always there, the restart policy just keeps it out
of the status line.

**3. Env vars are baked in at container-create time.** After fixing one, `restart` reuses the
broken container. Recreate:

```bash
docker compose --profile tools up -d --force-recreate pgadmin
```

Same root cause as the stale bind mount and the `volumes:` edit that did nothing — **any**
change to a container's definition needs a recreate, not a restart.

###### Connecting, step by step

```bash
docker compose --profile tools up -d pgadmin      # ~400 MB pull on first run
docker compose --profile tools logs -f pgadmin    # wait for "Listening at: http://[::]:80"
docker compose --profile tools ps                 # PORTS must show 0.0.0.0:5050->80/tcp
```

Then <http://localhost:5050> — no login screen in desktop mode. Left panel →
**Local (Docker)** → **Unifin — dev** → password `pw-unifin`, tick **Save Password** (it persists
in `pgadmin_data`).

| You want | Path |
|---|---|
| Table contents | Databases → db-unifin → Schemas → public → Tables → right-click → *View/Edit Data → All Rows* |
| Run SQL | Tools → **Query Tool** (`Alt+Shift+Q`) |
| Inspect a foreign key | Tables → `transactions` → Constraints |
| Confirm test isolation | switch to **Unifin — test** — same schema, no real rows |

If the server tree is empty, `servers.json` did not import (first-boot only). Targeted reset:

```bash
docker compose --profile tools down pgadmin
docker volume rm unifin_pgadmin_data      # ONLY pgAdmin's config volume
docker compose --profile tools up -d pgadmin
```

**Never `docker compose down -v` to fix this** — that also deletes `postgres_data` and wipes the
database.

**For Railway (8a)** — register prod through the UI, never in `servers.json` (that file is
committed): host/port/user/password from Railway's variables tab, **`SSL mode: require`** — not
`prefer`, which silently falls back to plaintext over the public internet. If you ever work on an
untrusted network, change the port binding to `"127.0.0.1:5050:80"`: a desktop-mode pgAdmin
holding a saved production password is an unauthenticated admin console.

##### `data/real/` layout — decided 2026-08-24

`data/real/` is gitignored and exists only on the dev machine. It has exactly one job: **be the
archive that can rebuild the database from scratch.** BP cannot re-export anything older than
90 days, so losing this directory is unrecoverable.

Organised by **export session**, not by bank — one export produces files for every account at the
same moment, and keeping them together preserves the "as of date X, this is what all my accounts
looked like" snapshot that reconciliation depends on. The existing filenames already carry the
export date.

```
data/real/
├── exports/                    # AS RECEIVED. Never edited, never renamed.
│   ├── 20241204/
│   ├── 20250418/
│   ├── 20260824/               # BP_TSV, BP_PDF, C24_*, TR_*
│   └── …
├── derived/                    # GENERATED here, not received from a bank
│   └── BP_MANUAL_2025-05_2026-05.tsv
└── inbox/                      # ETL_INPUT_DIR — what is being imported right now
```

- **`exports/` is immutable evidence.** If a parser bug corrupts an import, re-run against the
  original bytes. Never edit in place.
- **`derived/` is separate** because a hand-transcribed file can never byte-match a real export —
  a standing reminder of the 2026-05-25 cut rule (see the BP 90-day gap note in 4e).
- **`inbox/` is staging**, so `ETL_INPUT_DIR` points at one stable path instead of changing per
  session.
- **No per-account subdirectories for C24 pockets.** The `--account` flag plus the `Kontoname`
  assertion in 4c is the guard; a directory convention would be a second source of truth that
  drifts silently.

Fold the existing `bp/`, `c24/`, `temp/` into `exports/<date>/` before 4e, so the import loop is
one `for f in exports/*/BP_TSV_*.tsv`.

**Reminder — uploaded files are never stored.** The Phase 7 upload path writes to
`os.tmpdir()/<uuid>`, spawns the parser, and deletes the file in a `finally`. Only the parsed rows
and one `imports` row (with `filename` as a *display string*) persist. `data/real/` is the CLI
path only; the two never share a directory.

---

#### Phase 4b — Migrations M1–M4 + seeds
**1.0 session**

Four migrations, **in this order** — a foreign key's target table must exist before the table
referencing it. Knex runs migrations in filename order, so the timestamp prefix *is* the
ordering. Generate each with:

```bash
docker compose exec app npx knex migrate:make create_accounts --knexfile knexfile.ts
```
- `npx knex` — run the locally installed Knex CLI (no global install).
- `migrate:make <name>` — create a timestamped, empty migration file (Alembic's `revision`).
- `--knexfile knexfile.ts` — the CLI needs to be told, since the default lookup is `knexfile.js`.

> **Never edit a migration that has already run.** Append a new one. This is the same rule as
> Alembic, and the reason `alterTable` exists in M4.

##### Files

```
backend/src/db/migrations/<ts>_create_accounts.ts        NEW   M1
backend/src/db/migrations/<ts>_create_categories.ts      NEW   M2
backend/src/db/migrations/<ts>_create_imports.ts         NEW   M3
backend/src/db/migrations/<ts>_alter_transactions.ts     NEW   M4
backend/src/db/seeds/01_accounts.ts                      NEW
backend/src/db/seeds/02_categories.ts                    NEW
backend/src/db/seeds/03_category_rules.ts                NEW
backend/knexfile.ts                                      EDIT  add seeds directory
backend/src/db/schema.ts                                 NEW   shared TS types
backend/test/migrations.test.ts                          NEW
```

`knexfile.ts` needs one addition — the CLI does not guess the seeds path:

```diff
  migrations: {
    directory: "./src/db/migrations",
  },
+ seeds: {
+   directory: "./src/db/seeds",
+ },
```

---

##### M1 — `accounts`

```ts
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("accounts", (table) => {
    table.increments("id").primary();
    table.string("bank").notNullable();               // 'BP' | 'C24' | 'TR' | 'PAYPAL'
    table.string("account_type").notNullable();       // 'checking' | 'pocket' | 'broker' | 'wallet'
    table.string("currency", 3).notNullable().defaultTo("EUR");
    table.string("label").notNullable().unique();     // "C24 Pocket Food"
    table.decimal("opening_balance", 12, 2).notNullable().defaultTo(0);
    table.date("opening_balance_date");               // the balance was X on this date
    table.boolean("is_tracked").notNullable().defaultTo(true);
    table.timestamp("created_at").defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("accounts");
}
```

**`opening_balance` is what makes reconciliation possible at all.** The BP export starts in 2022 —
without a known balance at that date, every computed balance is off by whatever sat in the
account before the first imported row. §5.0 risk 4 is the offline homework that fills these in.

**`is_tracked`** (new, 2026-08-18) lets Trade Republic and PayPal exist as account *rows* — so a
`SAVINGS` transfer out of BP resolves to a named destination and `transfer_pair_id` has something
to point at — without their transactions being imported. Flip to `true` when the parser lands.

**`label` is `unique()`** because the seed is idempotent via `onConflict("label").merge()`
(below). Without the constraint, re-running `db.seed.run()` silently doubles your accounts —
and `globalSetup.ts` runs it on every single `npm test`.

###### Seed — `01_accounts.ts`

`account_id` is chosen **per import file**, not per row: no bank export carries a pocket marker,
so the CLI decides. The `id` values below are the ones you will pass to `--account`.

```ts
import type { Knex } from "knex";

export async function seed(knex: Knex): Promise<void> {
  await knex("accounts")
    .insert([
      { id: 1, bank: "BP",     account_type: "checking", label: "BP Compte Courant",
        opening_balance: 0, opening_balance_date: null,  is_tracked: true },
      { id: 2, bank: "C24",    account_type: "checking", label: "C24 Girokonto",
        opening_balance: 0, opening_balance_date: null,  is_tracked: true },
      { id: 3, bank: "C24",    account_type: "pocket",   label: "C24 Pocket Food",
        opening_balance: 0, opening_balance_date: null,  is_tracked: true },
      { id: 4, bank: "C24",    account_type: "pocket",   label: "C24 Pocket Savings",
        opening_balance: 0, opening_balance_date: null,  is_tracked: true },
      { id: 5, bank: "C24",    account_type: "pocket",   label: "C24 Pocket Rent",
        opening_balance: 0, opening_balance_date: null,  is_tracked: true },
      { id: 6, bank: "TR",     account_type: "broker",   label: "Trade Republic",
        opening_balance: 0, opening_balance_date: null,  is_tracked: false },  // → true in 4d
      { id: 7, bank: "PAYPAL", account_type: "wallet",   label: "PayPal",
        opening_balance: 0, opening_balance_date: null,  is_tracked: false },  // enricher only
    ])
    // Idempotent: re-running updates instead of duplicating.
    // Python analogy: this is an UPSERT, like pandas' combine_first
    // rather than a blind concat.
    .onConflict("label")
    .merge();

  // increments() has its own sequence; explicit ids leave it at 0,
  // so the next un-seeded insert would collide on id = 1.
  await knex.raw(
    "SELECT setval('accounts_id_seq', (SELECT MAX(id) FROM accounts))",
  );
}
```

###### `opening_balance` — anchored at 2026-01-01 (decided 2026-08-18)

Rather than hunting the 2022 balance, all accounts anchor at **`opening_balance_date = '2026-01-01'`**
with the real balance on that date. Pragmatic and correct — but it comes with one hard constraint
and one consequence, both of which have to be written down now or they become a bug hunt in week 5.

**Convention — pick it once, here.** `opening_balance` is the balance **after** all transactions
dated on or before `opening_balance_date`. That is what a bank statement means by
`Solde (EUROS)` at a given `Date`, and it is what `imports.statement_balance` /
`statement_date` will hold — so reconciliation compares like with like. The running balance is
therefore:

```sql
SELECT a.opening_balance + COALESCE(SUM(t.amount), 0) AS balance
FROM accounts a
LEFT JOIN transactions t
  ON t.account_id = a.id
 AND t.date > a.opening_balance_date     -- strictly greater: the anchor already includes that day
WHERE a.id = ?
GROUP BY a.id, a.opening_balance;
```

Using `>=` instead of `>` double-counts every transaction dated 2026-01-01. That is the entire bug,
and it is invisible unless something happened on New Year's Day.

**Consequence: the 2022–2025 rows do not reconcile, by construction.** They still import, still
appear in the transactions table, and still count toward yearly category totals — those are sums,
not balances, and need no anchor. Only the *running balance* view is undefined before 2026-01-01.
Phase 6 must therefore either scope the balance card to `date > opening_balance_date` or label it
"since 01.01.2026" — not silently show a number that is wrong by four years of history.

> ⚠️ **Still open — blocking for Phase 6, not for Phase 4.** `opening_balance` is seeded `0` above.
> Look up the real 2026-01-01 balance for BP, C24 Girokonto, each of the 3 pockets, and Trade
> Republic, then patch these rows. Until then the reconciliation view is off by a constant — a
> *known* wrong number, not a bug to hunt.

---

##### M2 — `categories` + `category_rules`

```ts
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("categories", (table) => {
    table.increments("id").primary();
    table.string("label").notNullable().unique();
    table.enu("type", ["income", "expense", "transfer"]).notNullable();
    table.boolean("visible").notNullable().defaultTo(true);
  });

  await knex.schema.createTable("category_rules", (table) => {
    table.increments("id").primary();
    table.string("bank");                             // 'BP'|'C24'|'TR' — null = all banks
    table.enu("match_field", ["normalized_name", "bank_category", "mcc"])
         .notNullable().defaultTo("normalized_name");
    table.enu("match_type", ["contains", "exact"])
         .notNullable().defaultTo("contains");
    table.string("pattern").notNullable();
    table.integer("category_id").notNullable()
         .references("id").inTable("categories").onDelete("CASCADE");
    table.integer("priority").notNullable().defaultTo(100);    // lower wins
    table.decimal("confidence", 3, 2).notNullable().defaultTo(1.00);
    table.unique(["bank", "match_field", "pattern"]);          // idempotent seeding
    table.index(["bank", "match_field", "priority"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("category_rules");   // drop the child first —
  await knex.schema.dropTable("categories");       // the FK blocks the other order
}
```

**One table, three behaviours.** You asked for per-bank rules *and* a per-bank fallback. Three
tables would mean three matching loops and three CRUD screens in Phase 5. `match_field` collapses
them into one:

| `bank` | `match_field` | `match_type` | `pattern` | → category | `priority` | `confidence` |
|---|---|---|---|---|---|---|
| `null` | `normalized_name` | contains | `LIDL` | FOOD & Households | 10 | 1.00 |
| `BP` | `normalized_name` | contains | `VIREMENT DE COMPO` | ARBEIT | 10 | 1.00 |
| `TR` | `mcc` | exact | `5411` | FOOD & Households | 50 | 0.90 |
| `C24` | `bank_category` | exact | `Lebensmittel` | FOOD & Households | 90 | 0.50 |

**`priority` *is* the "rules first, bank fallback second" policy** — explicit patterns at 10, MCC
codes at 50, bank-supplied categories at 90. No branching in the matcher: one `ORDER BY priority`,
take the first hit. And because the policy is data rather than code, Phase 5's rules screen is
plain CRUD over one table — exactly the "editable in code now, in the app later" you asked for.

**`confidence` lives on the rule, not the row.** A `LIDL` substring match is certain; a
`Lebensmittel` bank-category fallback is a guess. The matcher copies the rule's confidence onto
`transactions.category_confidence`, so Phase 5 can sort "review these first" without knowing
anything about *why* a row is uncertain.

**Note on `table.enu()` on Postgres:** Knex compiles it to `varchar` + a `CHECK` constraint, not
a native `CREATE TYPE`. Adding a value later means dropping and recreating the constraint in a new
migration. Both enums above are closed sets — get them right now.

###### Seed — `02_categories.ts`

Taxonomy from `FOLGUNG_der_Kontos_WIP.xlsx`. **Every internal-transfer category must be
`type = 'transfer'`, or Phase 6's yearly totals will lie.**

```ts
type Row = { label: string; type: "income" | "expense" | "transfer" };

const CATEGORIES: Row[] = [
  // ── expenses ──────────────────────────────────────────────
  { label: "FOOD & Households",  type: "expense"  },
  { label: "HOUSING rent",       type: "expense"  },
  { label: "TRANSPORT",          type: "expense"  },
  { label: "HOBBIES",            type: "expense"  },
  { label: "HEALTH",             type: "expense"  },
  { label: "TRIPS",              type: "expense"  },
  { label: "STUDIES",            type: "expense"  },
  { label: "PHONE bundle",       type: "expense"  },
  { label: "PARTIES & Sorties",  type: "expense"  },
  { label: "OTHERS-outflow",     type: "expense"  },
  // ── income ────────────────────────────────────────────────
  { label: "ARBEIT",             type: "income"   },
  { label: "BRMI",               type: "income"   },
  { label: "CROUS",              type: "income"   },
  { label: "Erasmus+",           type: "income"   },
  { label: "OTHERS-inflow",      type: "income"   },
  // ── transfers — excluded from income AND expense totals ───
  { label: "SAVINGS",            type: "transfer" },   // → Trade Republic
  { label: "INVESTING",          type: "transfer" },   // TR cash → securities (4d)
  { label: "BALU",               type: "transfer" },   // BP ↔ C24
  { label: "C24 pockets",        type: "transfer" },   // Girokonto ↔ pocket
];
```

Same `onConflict("label").merge()` + `setval` pattern as `01_accounts.ts`.

**No `Uncategorized` row.** `category_id IS NULL` means uncategorized. A row representing "no row"
is a trap: every aggregate query then needs a special case to exclude it.

###### Naming convention (2026-08-18)

Labels are **display strings** — they render in the transactions table's category chip and in the
Phase 5 dropdown. Rules: Sentence case, no `&`, no ALL-CAPS, no language mixing, no leading
qualifier (`OTHERS-inflow` sorts under O, which is wrong — the user thinks "other income").

| Old | New | type |
|---|---|---|
| FOOD & Households | `Groceries and household` | expense |
| HOUSING rent | `Housing` | expense |
| TRANSPORT | `Transport` | expense |
| HOBBIES | `Hobbies` | expense |
| HEALTH | `Health` | expense |
| TRIPS | `Travel` | expense |
| STUDIES | `Studies` | expense |
| PHONE bundle | `Phone and internet` | expense |
| PARTIES & Sorties | `Going out` | expense |
| OTHERS-outflow | `Other expenses` | expense |
| ARBEIT | `Salary` | income |
| BRMI | `Scholarship BRMI` | income |
| CROUS | `Scholarship CROUS` | income |
| Erasmus+ | `Scholarship Erasmus` | income |
| OTHERS-inflow | `Other income` | income |
| SAVINGS | `Savings transfer` | transfer |
| INVESTING | `Investment purchase` | transfer |
| BALU | `Transfer between banks` | transfer |
| C24 pockets | `Pocket transfer` | transfer |

**Renaming is cheap forever, so do not agonise.** `category_rules` references `category_id`, a
foreign key — not the label. After 4b has run, a rename is `UPDATE categories SET label = …` and
nothing else moves. The *only* place a label is resolved by string is `03_category_rules.ts`, which
looks the ids up at seed time. So: settle the names before 4b runs and it costs nothing; change them
afterwards and you update one seed file.

> ⚠️ **Still open — blocking for 4c.** Confirm, correct or replace the table above, and say whether
> any labels are missing or should be dropped.

###### Seed — `03_category_rules.ts`

Three blocks, one array. Priorities are deliberately spaced so you can wedge new rules between
them without renumbering.

```ts
// ── 10: explicit merchant rules — certain ────────────────────
{ bank: null,  match_field: "normalized_name", match_type: "contains",
  pattern: "LIDL",       category: "FOOD & Households", priority: 10, confidence: 1.00 },
{ bank: null,  match_field: "normalized_name", match_type: "contains",
  pattern: "ALDI",       category: "FOOD & Households", priority: 10, confidence: 1.00 },
{ bank: null,  match_field: "normalized_name", match_type: "contains",
  pattern: "REWE",       category: "FOOD & Households", priority: 10, confidence: 1.00 },
{ bank: null,  match_field: "normalized_name", match_type: "contains",
  pattern: "DM DROGERIE", category: "FOOD & Households", priority: 10, confidence: 1.00 },
{ bank: null,  match_field: "normalized_name", match_type: "contains",
  pattern: "FITX",       category: "HEALTH",            priority: 10, confidence: 1.00 },
{ bank: null,  match_field: "normalized_name", match_type: "contains",
  pattern: "DB VERTRIEB", category: "TRANSPORT",        priority: 10, confidence: 1.00 },
{ bank: null,  match_field: "normalized_name", match_type: "contains",
  pattern: "SNCF",       category: "TRANSPORT",         priority: 10, confidence: 1.00 },
{ bank: "BP",  match_field: "normalized_name", match_type: "contains",
  pattern: "COMPO GMBH", category: "ARBEIT",            priority: 10, confidence: 1.00 },
{ bank: "BP",  match_field: "normalized_name", match_type: "contains",
  pattern: "TECHNIKER KRANKEN", category: "HEALTH",     priority: 10, confidence: 1.00 },
{ bank: "TR",  match_field: "normalized_name", match_type: "contains",
  pattern: "TRADEREPUBLIC", category: "SAVINGS",        priority: 10, confidence: 1.00 },

// ── 50: TR merchant category codes (ISO 18245) — reliable ────
{ bank: "TR", match_field: "mcc", match_type: "exact", pattern: "5411",
  category: "FOOD & Households", priority: 50, confidence: 0.90 },  // grocery stores
{ bank: "TR", match_field: "mcc", match_type: "exact", pattern: "5462",
  category: "FOOD & Households", priority: 50, confidence: 0.90 },  // bakeries
{ bank: "TR", match_field: "mcc", match_type: "exact", pattern: "5499",
  category: "FOOD & Households", priority: 50, confidence: 0.90 },  // misc food stores
{ bank: "TR", match_field: "mcc", match_type: "exact", pattern: "5812",
  category: "PARTIES & Sorties", priority: 50, confidence: 0.85 },  // restaurants
{ bank: "TR", match_field: "mcc", match_type: "exact", pattern: "5813",
  category: "PARTIES & Sorties", priority: 50, confidence: 0.85 },  // bars / taverns
{ bank: "TR", match_field: "mcc", match_type: "exact", pattern: "5814",
  category: "PARTIES & Sorties", priority: 50, confidence: 0.85 },  // fast food
{ bank: "TR", match_field: "mcc", match_type: "exact", pattern: "5912",
  category: "HEALTH",            priority: 50, confidence: 0.90 },  // pharmacies
{ bank: "TR", match_field: "mcc", match_type: "exact", pattern: "4112",
  category: "TRANSPORT",         priority: 50, confidence: 0.90 },  // passenger rail
{ bank: "TR", match_field: "mcc", match_type: "exact", pattern: "4784",
  category: "TRANSPORT",         priority: 50, confidence: 0.90 },  // tolls / bridge fees
{ bank: "TR", match_field: "mcc", match_type: "exact", pattern: "7523",
  category: "TRANSPORT",         priority: 50, confidence: 0.90 },  // parking
{ bank: "TR", match_field: "mcc", match_type: "exact", pattern: "4215",
  category: "OTHERS-outflow",    priority: 50, confidence: 0.70 },  // courier services
{ bank: "TR", match_field: "mcc", match_type: "exact", pattern: "8220",
  category: "STUDIES",           priority: 50, confidence: 0.90 },  // universities

// ── 90: C24's own taxonomy — a guess, never confirmed ────────
{ bank: "C24", match_field: "bank_category", match_type: "exact",
  pattern: "Lebensmittel",           category: "FOOD & Households", priority: 90, confidence: 0.50 },
{ bank: "C24", match_field: "bank_category", match_type: "exact",
  pattern: "Wohnen & Haushalt",      category: "HOUSING rent",      priority: 90, confidence: 0.50 },
{ bank: "C24", match_field: "bank_category", match_type: "exact",
  pattern: "DSL & Mobilfunk",        category: "PHONE bundle",      priority: 90, confidence: 0.50 },
{ bank: "C24", match_field: "bank_category", match_type: "exact",
  pattern: "Restaurant/ Café/ Bar",  category: "PARTIES & Sorties", priority: 90, confidence: 0.50 },
{ bank: "C24", match_field: "bank_category", match_type: "exact",
  pattern: "Freizeit & Unterhaltung", category: "HOBBIES",          priority: 90, confidence: 0.50 },
{ bank: "C24", match_field: "bank_category", match_type: "exact",
  pattern: "Geldanlage",             category: "SAVINGS",           priority: 90, confidence: 0.50 },
{ bank: "C24", match_field: "bank_category", match_type: "exact",
  pattern: "Einkommen",              category: "ARBEIT",            priority: 90, confidence: 0.50 },
{ bank: "C24", match_field: "bank_category", match_type: "exact",
  pattern: "Versicherungen",         category: "HEALTH",            priority: 90, confidence: 0.50 },
{ bank: "C24", match_field: "bank_category", match_type: "exact",
  pattern: "Shopping",               category: "OTHERS-outflow",    priority: 90, confidence: 0.40 },
{ bank: "C24", match_field: "bank_category", match_type: "exact",
  pattern: "Bargeld",                category: "OTHERS-outflow",    priority: 90, confidence: 0.30 },
```

The C24 block covers **all 13** `Kategorie` values present in the real exports, so every C24 row
gets at least a guess. The seed resolves `category` labels to ids with one lookup query — never
hardcode category ids in the rules seed, or reordering `02_categories.ts` silently re-points every
rule.

> ⚠️ **Still open — improves 4c's hit rate, does not block it.** Give ~10 more real
> `pattern → category` pairs from your own spending. I will generate the rest from BP/C24 payee
> frequency for you to correct.

---

##### M3 — `imports` (one row per file fed in)

```ts
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("imports", (table) => {
    table.increments("id").primary();
    table.integer("account_id").notNullable()
         .references("id").inTable("accounts");
    table.string("filename").notNullable();
    table.integer("row_count").notNullable().defaultTo(0);       // rows present in the file
    table.integer("inserted_count").notNullable().defaultTo(0);  // actually new
    table.integer("skipped_count").notNullable().defaultTo(0);   // duplicates rejected
    table.decimal("statement_balance", 12, 2);                   // what the bank says — nullable
    table.date("statement_date");
    table.timestamp("imported_at").defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("imports");
}
```

Serves two features from one table: the dedupe audit trail *and* the reconciliation anchor.
Folding `statement_balance` in here rather than a separate `account_statements` table is slightly
impure (re-importing a file duplicates the balance record) but harmless at this scale — one table
beats two.

`statement_balance` / `statement_date` come from the BP header block (`Solde (EUROS)  2353,07`,
`Date  15/02/2024`), which is why `bp.py` must stop throwing those 7 lines away — see 4c.

**The three counts default to `0` on purpose.** There is a chicken-and-egg problem in 4c:
`transactions.import_id` references `imports.id`, so the import row must exist *before* the
transactions — but `inserted_count` is unknowable until *after* they are inserted. The sequence is
INSERT with zeros → get `id` → insert transactions → `UPDATE` the counts, all inside one
transaction so a mid-import crash leaves no half-written import row.

---

##### M4 — `alterTable("transactions")`

Append-only on top of the Phase 2a table. **This is the migration that matters.**

```ts
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("transactions", (table) => {
    // --- ownership + traceability ---
    table.integer("account_id").references("id").inTable("accounts");
    table.integer("import_id").references("id").inTable("imports");
    table.string("source_file");
    table.timestamp("imported_at").defaultTo(knex.fn.now());

    // --- categorization: rules, AI and manual all land in these four ---
    table.integer("category_id").references("id").inTable("categories");
    table.enu("category_source", ["rule", "ai", "manual"]);  // null = uncategorized
    table.decimal("category_confidence", 3, 2);              // 0.00–1.00
    table.timestamp("category_confirmed_at");                // null = TEMPORARY

    // --- matching key: search, rules and (later) the AI all read this ---
    table.string("normalized_name").notNullable().defaultTo("");

    // --- provenance from the source export (added 2026-08-18) ---
    table.string("external_id");     // TR's UUID, PayPal's Transaction ID — null for BP/C24
    table.string("counterparty");    // clean payee, separate from the noisy raw_name

    // --- duplicate detection ---
    table.string("dedupe_hash").notNullable().defaultTo("");
    table.integer("dedupe_seq").notNullable().defaultTo(0);
    table.unique(["dedupe_hash", "dedupe_seq"]);

    // --- internal transfers ---
    table.integer("transfer_pair_id").references("id").inTable("transactions");

    // --- soft delete (added 2026-08-24) ---
    // A hard DELETE is self-undoing: removing the row frees its
    // (dedupe_hash, dedupe_seq), so the next import of any overlapping
    // export re-inserts it. The row must stay and hold its hash.
    // Every Phase 6 aggregate filters `WHERE ignored_at IS NULL`.
    table.timestamp("ignored_at");   // null = counts toward totals
    table.string("ignored_reason");  // 'duplicate' | 'bank_error' | 'manual'

    table.index("normalized_name");
    table.index("date");
    table.index("category_id");
    table.index("account_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("transactions", (table) => {
    table.dropUnique(["dedupe_hash", "dedupe_seq"]);
    table.dropColumns(
      "account_id", "import_id", "source_file", "imported_at",
      "category_id", "category_source", "category_confidence", "category_confirmed_at",
      "normalized_name", "external_id", "counterparty",
      "dedupe_hash", "dedupe_seq", "transfer_pair_id",
      "ignored_at", "ignored_reason",
    );
  });
}
```

###### `dedupe_seq` exists because a naive unique hash is wrong — and your real data proves it

Two €2.50 coffees at the same shop on the same day are two real transactions, not a duplicate.
Measured across your 11 BP exports on 2026-08-18:

```
1484 rows total · 832 distinct · 464 (date, name, amount) triples shared BETWEEN files
                                  26 rows duplicated WITHIN a single file
```

Those 26 are real: **three** €13.00 `BEER KING` charges on 12/03/2024, **three** €5.00
`CREDIT CARTE BANCAIRE DOCKLAND GMBH` on 02/05/2024. A hash-only unique constraint silently eats
them. So:

```
dedupe_hash = sha256(f"{account_id}|{date:%Y-%m-%d}|{amount:.2f}|{raw_name}")
dedupe_seq  = 0, 1, 2… numbering identical hashes within a single import file
```

Walk the BEER KING case through it:

| Import | File contains | Computed `(hash, seq)` | Result |
|---|---|---|---|
| 1st | 3 identical rows | `(h,0) (h,1) (h,2)` | 3 inserted |
| 2nd (overlapping export) | same 3 rows | `(h,0) (h,1) (h,2)` | 3 rejected by the unique constraint |
| 3rd (a 4th beer happened) | 4 identical rows | `(h,0) (h,1) (h,2) (h,3)` | 3 rejected, **1 inserted** ✓ |

It is order-independent (identical rows are indistinguishable, so which one gets `seq = 0`
does not matter) and direction-independent (importing the 4-row file first, then the 3-row file,
also lands on 4 rows). ~10 lines of Python, and it is the difference between a database you trust
and one you don't.

> **Hash `raw_name`, never `normalized_name`.** The normalizer *will* be improved — Phase 9's
> recurring detection wants tighter grouping. If the hash reads `normalized_name`, that
> improvement silently changes every historical hash, and the next re-import of an old export
> inserts all 832 rows again as "new". Hash the raw, match on the normalized. This is the single
> easiest way to destroy the dataset in week 4.

**Trade Republic is the exception** (4d): its export ships a native stable `transaction_id` UUID.
For TR, `dedupe_hash = transaction_id` and `dedupe_seq` stays `0` forever. Better than any hash
you can compute, and it doubles as an independent check on the sha256 path.

###### The pending-date problem — measured 2026-08-24, and why we are NOT solving it

*The concern:* a transaction appears in one export dated the day of export (a pending
placeholder), then in a later export with its real settlement date. The date is in the hash, so
the two rows hash differently and both insert. A silent double-count.

*The measurement.* Across all 11 real BP exports and all 3 C24 exports, every pair compared: the
same `(libellé, amount)` appearing with a date shifted 1–10 days between two exports occurs
**zero times**. (A first pass flagged 9 hits, all `COTISATION TRIMESTRIELLE` — the quarterly
account fee, same amount three months apart. Genuine recurring charges, not date shifts.)
Conclusion: **BP and C24 export only booked transactions.** The pending placeholder is in the
bank's app UI, not the file. Trade Republic is untested — only one export exists, so no pair.

*Why fuzzy matching at import is rejected:*
- It breaks the `BEER KING ×3` case. A 4th genuine beer two days later at the same bar is
  indistinguishable from a date-shifted duplicate. **A missing real transaction is worse than a
  visible duplicate** — the duplicate you can see and fix, the missing one makes totals wrong
  forever, silently.
- It destroys determinism. "Same file twice → `inserted_count = 0`" stops being provable once the
  result depends on existing table contents, which makes 4c's DoD meaningless.
- Removing `date` from the hash is worse still: a €13 beer in March and one in June then collide.

*What we do instead* — decided 2026-08-24:
1. **Prefer a bank-supplied stable ID.** TR's UUID now (4d); BP OFX's `FITID` in Phase 11. Where
   the bank provides identity, the problem cannot occur by construction.
2. **`ignored_at` / `ignored_reason` in M4** (above). Needed regardless — a hard delete frees the
   `(dedupe_hash, dedupe_seq)` pair and the row returns on the next overlapping import.
3. **Report, never act.** The 4c import summary runs one near-match query over the rows just
   inserted (same `account_id`, same `amount`, same `normalized_name`, different `date`, ≤7 days
   apart) and prints *"N possible duplicates — review"*. Note this query reads
   `normalized_name` — legitimate here precisely because it is computed live, unlike the hash.
4. **Re-measure in 4e.** The historical exports are 2023–2025 and the 2026-08-24 export does not
   overlap them. Two overlapping *2026* exports would settle current-day behaviour; re-run
   `scripts/check_date_shift.py` then.

*Do not overload category for this.* "This row is wrong" and "this row is uncategorized" are
orthogonal — the same reason `category_confirmed_at` is orthogonal to `category_source`.

###### The other columns

**`normalized_name`** — `raw_name` uppercased, punctuation, dates, amounts and card references
stripped: `"ACHAT CB Lidl sagt Dank 13.12.23 EUR    62,50 CARTE NO  454  "` → `"LIDL SAGT DANK"`.
One column, four features get better: search matches, rules match, recurring detection groups
(Phase 9), and the AI sees ~200 distinct strings instead of ~900 (Phase 10).

**`external_id` + `counterparty`** (added 2026-08-18) — four lines now, a painful backfill later.
`external_id` makes TR dedupe exact and is the join key PayPal enrichment needs.
`counterparty` holds the clean payee (`Bolt Operations OÜ`) apart from the noisy `raw_name`.

> **The PayPal problem, recorded here so it is not rediscovered.** 77 of your 832 distinct BP rows
> (9.3%, €4 675.22) are `ACHAT CB PAYPAL` with the merchant truncated to 6 characters —
> `PAYPAL  BOLT.E`, `PAYPAL  Julian`, `PAYPAL  PMNTSB`. They are permanently uncategorizable from
> BP alone. PayPal's own export is the decoder ring, **but it must not be imported as an account**:
> every purchase appears there twice (the payment *and* a `General Card Deposit` funding row that
> nets to zero) plus a third time as the card charge in BP. Importing it counts each purchase 3×.
> The correct shape is an enrichment join — match on `(date ± 2 days, amount)`, overwrite
> `normalized_name` and `counterparty` — deferred to post-launch, ~0.5 session.

**Do not add `'transfer'` to the `flow` enum.** `flow` is the sign of the amount — a transfer is
still an outflow on one side and an inflow on the other. Transfer-ness belongs on
`categories.type`. And since Knex's `table.enu()` compiles on Postgres to a `varchar` + `CHECK`,
extending it later means dropping and recreating that constraint in a new migration.

---

##### Step 4b.4 — Shared TS types

`backend/src/db/schema.ts` — one place the whole backend agrees on the row shapes. Written now,
consumed by Phase 5's controllers.

```ts
export type CategoryType = "income" | "expense" | "transfer";
export type CategorySource = "rule" | "ai" | "manual";
export type Flow = "income" | "expense";

export type Account = {
  id: number;
  bank: string;
  account_type: string;
  currency: string;
  label: string;
  opening_balance: string;      // Knex returns numeric as string — cast at the edge
  opening_balance_date: string | null;
  is_tracked: boolean;
};

export type TransactionRow = {
  id: number;
  account_id: number | null;
  import_id: number | null;
  date: string;
  raw_name: string;
  normalized_name: string;
  counterparty: string | null;
  external_id: string | null;
  amount: string;
  flow: Flow;
  category_id: number | null;
  category_source: CategorySource | null;
  category_confidence: string | null;
  category_confirmed_at: string | null;
  dedupe_hash: string;
  dedupe_seq: number;
  transfer_pair_id: number | null;
  source_file: string | null;
  imported_at: string;
};
```

---

##### Tests — `backend/test/migrations.test.ts`

`globalSetup.ts` already ran `migrate.latest()` + `seed.run()`, so these assert on the result.

```ts
import { describe, test, expect, afterAll } from "vitest";
import { db } from "../src/db/knex.js";

afterAll(async () => { await db.destroy(); });

describe("schema", () => {
  test("all five tables exist", async () => {
    for (const t of ["accounts", "categories", "category_rules", "imports", "transactions"]) {
      expect(await db.schema.hasTable(t)).toBe(true);
    }
  });

  test("the dedupe unique constraint is enforced", async () => {
    const base = {
      date: "2026-03-12", raw_name: "BEER KING", amount: -13, flow: "expense",
      account_id: 1, dedupe_hash: "abc123", dedupe_seq: 0,
    };
    await db("transactions").insert(base);
    // same hash, next seq → a genuinely different transaction, must insert
    await db("transactions").insert({ ...base, dedupe_seq: 1 });
    // same hash AND same seq → must be rejected
    await expect(db("transactions").insert(base)).rejects.toThrow();
  });

  test("every transfer category is typed 'transfer'", async () => {
    const rows = await db("categories")
      .whereIn("label", ["SAVINGS", "INVESTING", "BALU", "C24 pockets"]);
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.type === "transfer")).toBe(true);
  });

  test("every rule points at a category that exists", async () => {
    const orphans = await db("category_rules as r")
      .leftJoin("categories as c", "r.category_id", "c.id")
      .whereNull("c.id");
    expect(orphans).toHaveLength(0);
  });

  test("seeds are idempotent", async () => {
    const before = await db("categories").count();
    await db.seed.run();
    expect(await db("categories").count()).toEqual(before);
  });
});
```

The third test is the one that protects Phase 6. The fifth is the one that protects every future
`npm test`.

**DoD 4b**
```bash
docker compose exec app npx knex migrate:latest  --knexfile knexfile.ts
docker compose exec app npx knex migrate:rollback --knexfile knexfile.ts --all
docker compose exec app npx knex migrate:latest  --knexfile knexfile.ts
docker compose exec app npx knex seed:run        --knexfile knexfile.ts
docker compose exec app npm test
```
- `migrate:rollback --all` — run every migration's `down()` in reverse order. **If any `down()` is
  missing or wrong, this is where you find out** — not at 2am against the Railway database.

Round-trip clean, seeds run twice with no duplicates, `migrations.test.ts` green.

---

#### Phase 4c — ETL core: normalize → hash → categorize → insert (BP + C24)
**1.25 sessions** · *The highest-risk step in the plan. Run against `data/sample/` until it is
boring, then against real data.*

##### Files

```
backend/python/bank/normalize.py     NEW    raw_name → normalized_name
backend/python/bank/dedupe.py        NEW    hash + seq
backend/python/bank/categorize.py    NEW    the rules loop
backend/python/bank/db_insert.py     NEW    the only file that talks to Postgres
backend/python/bank/bp.py            EDIT   return the header block, drop the pd.to_numeric detour
backend/python/bank/c24.py           EDIT   surface Kategorie + Zahlungsempfänger
backend/python/bank/test_etl.py      NEW    pytest, no DB required
backend/python/requirements.txt      NEW    pandas, psycopg2-binary, pytest
```

One module per verb, each independently testable. `db_insert.py` is the only one that opens a
connection — the other three are pure functions over strings and DataFrames, so `test_etl.py`
runs without Postgres at all.

---

##### Step 4c.1 — `normalize.py` (pure, no DB, testable first)

```python
import re

# Order matters: strip the noisiest patterns before collapsing whitespace.
_PREFIXES = re.compile(
    r"^(ACHAT CB|PRELEVEMENT DE|PRLV SEPA|VIREMENT INSTANTANE (DE|A|POUR)|"
    r"VIREMENT (DE|POUR)|RETRAIT|CREDIT CARTE BANCAIRE)\s+", re.I)
_CARD_REF  = re.compile(r"\s*CARTE (NO|NUMERO)\s+\d+\s*$", re.I)
_AMOUNT    = re.compile(r"\s*EUR\s+[\d\s.,]+", re.I)
_DATE      = re.compile(r"\b\d{2}[./]\d{2}[./]\d{2,4}\b")
_REF       = re.compile(r"\bREF\s*:.*$", re.I)
_PUNCT     = re.compile(r"[^A-Z0-9&\s]")
_WS        = re.compile(r"\s+")

def normalize(raw: str) -> str:
    """'ACHAT CB Lidl sagt Dank 13.12.23 EUR   62,50 CARTE NO  454  ' -> 'LIDL SAGT DANK'"""
    s = (raw or "").strip().strip('"')
    s = _CARD_REF.sub("", s)
    s = _AMOUNT.sub("", s)
    s = _DATE.sub("", s)
    s = _REF.sub("", s)
    s = _PREFIXES.sub("", s)
    s = s.upper()
    s = _PUNCT.sub(" ", s)
    return _WS.sub(" ", s).strip()
```

**Tests first — this is the cheapest thing in the phase to get right and the most expensive to get
wrong** (it feeds search, rules, Phase 9 grouping and Phase 10 costs):

```python
import pytest
from normalize import normalize

@pytest.mark.parametrize("raw,expected", [
    ('ACHAT CB Lidl sagt Dank 13.12.23 EUR         62,50 CARTE NO  454  ', "LIDL SAGT DANK"),
    ('ACHAT CB PAYPAL  DBVERT 18.08.24 CARTE NUMERO                454  ', "PAYPAL DBVERT"),
    ('VIREMENT DE COMPO GmbH Lohn/Gehalt 12345',                           "COMPO GMBH LOHN GEHALT 12345"),
    ('PRELEVEMENT DE FitX Deutschland REF : 64--0028-0008121 / 64-204',    "FITX DEUTSCHLAND"),
    ('"VIREMENT DEBIT"',                                                    "VIREMENT DEBIT"),
    ('ACHAT CB CAFÉ DES ARTS 01.03.26 EUR  8,50 CARTE NO  111  ',          "CAF DES ARTS"),
    ('', ""),
    (None, ""),
])
def test_normalize(raw, expected):
    assert normalize(raw) == expected
```

Note the `CAFÉ → CAF` case: `_PUNCT` strips non-ASCII. That is a **deliberate, asserted** choice —
accents are inconsistent across banks, so dropping them makes matching more reliable, not less.
The accented fixture row proves the file *decoded* correctly (you'd get `CAFÃ` on a bad decode,
which the test catches); the normalizer then flattens it on purpose.

**DoD 4c.1:** `pytest backend/python/bank/test_etl.py -k normalize` green. No database involved.

---

##### Step 4c.2 — `dedupe.py`

```python
import hashlib
from collections import defaultdict

def compute_hash(account_id: int, date, amount: float, raw_name: str) -> str:
    """Hash the RAW name, never the normalized one — see M4."""
    key = f"{account_id}|{date:%Y-%m-%d}|{amount:.2f}|{raw_name}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()

def assign_seq(hashes: list[str]) -> list[int]:
    """0,1,2… numbering identical hashes within ONE import file."""
    seen = defaultdict(int)
    out = []
    for h in hashes:
        out.append(seen[h])
        seen[h] += 1
    return out
```

`f"{amount:.2f}"` is not cosmetic: `-13` and `-13.0` are the same float but different strings, and
a different string is a different hash. Fixing the precision at the hash boundary is what makes
the value stable across pandas dtype changes.

```python
def test_assign_seq_numbers_identical_rows():
    assert assign_seq(["a", "a", "a", "b"]) == [0, 1, 2, 0]

def test_hash_is_stable_across_int_and_float_amounts():
    from datetime import date
    a = compute_hash(1, date(2026, 3, 12), -13,   "BEER KING")
    b = compute_hash(1, date(2026, 3, 12), -13.0, "BEER KING")
    assert a == b

def test_hash_changes_with_account():
    from datetime import date
    assert compute_hash(1, date(2026, 3, 12), -13, "X") != \
           compute_hash(2, date(2026, 3, 12), -13, "X")
```

**DoD 4c.2:** the three tests pass.

---

##### Step 4c.3 — `categorize.py` (the rules loop)

Reads the rules **once** into memory, then matches in Python. ~30 rules × ~1000 rows is 30k
string operations — instant, and one query beats a thousand round-trips.

```python
def load_rules(cur) -> list[dict]:
    cur.execute("""
        SELECT bank, match_field, match_type, pattern, category_id, confidence
        FROM category_rules
        ORDER BY priority ASC, id ASC
    """)
    return [dict(zip([c.name for c in cur.description], r)) for r in cur.fetchall()]

def match(row: dict, bank: str, rules: list[dict]) -> tuple[int | None, float | None]:
    """Returns (category_id, confidence). First hit wins — rules are priority-ordered."""
    for r in rules:
        if r["bank"] is not None and r["bank"] != bank:
            continue
        haystack = {
            "normalized_name": row.get("normalized_name") or "",
            "bank_category":   row.get("bank_category") or "",
            "mcc":             str(row.get("mcc") or ""),
        }[r["match_field"]]
        if not haystack:
            continue
        hit = (r["pattern"].upper() in haystack.upper()
               if r["match_type"] == "contains"
               else haystack.strip().casefold() == r["pattern"].strip().casefold())
        if hit:
            return r["category_id"], float(r["confidence"])
    return None, None
```

A match sets `category_source = 'rule'` and leaves **`category_confirmed_at = NULL`** — the guess
is not a decision. Phase 5 renders those with a dashed chip border; clicking a category sets
`source = 'manual'` and stamps `confirmed_at`.

```python
def test_priority_beats_bank_fallback():
    rules = [
        {"bank": None,  "match_field": "normalized_name", "match_type": "contains",
         "pattern": "LIDL", "category_id": 1, "confidence": 1.0},
        {"bank": "C24", "match_field": "bank_category",   "match_type": "exact",
         "pattern": "Shopping", "category_id": 9, "confidence": 0.4},
    ]
    row = {"normalized_name": "LIDL SAGT DANK", "bank_category": "Shopping"}
    assert match(row, "C24", rules) == (1, 1.0)   # explicit rule wins

def test_bank_scoped_rule_ignored_for_other_bank():
    rules = [{"bank": "BP", "match_field": "normalized_name", "match_type": "contains",
              "pattern": "COMPO", "category_id": 11, "confidence": 1.0}]
    assert match({"normalized_name": "COMPO GMBH"}, "C24", rules) == (None, None)

def test_no_match_returns_none():
    assert match({"normalized_name": "SOMETHING NEW"}, "BP", []) == (None, None)
```

**DoD 4c.3:** the three tests pass. Note all of 4c.1–4c.3 run with **zero database** — that is the
point of splitting the modules this way.

---

##### Step 4c.4 — `db_insert.py` (the only module that touches Postgres)

```bash
python3 backend/python/bank/db_insert.py \
    --bank BP \
    --account 1 \
    --file data/sample/sample_bp.tsv
```
- `--bank` — selects the parser (`bp.py` / `c24.py` / `tr.py`) **and** scopes the rule lookup.
- `--account` — the `accounts.id` this file belongs to. **Required, no default.** No export
  carries a pocket marker, so this is the only thing that can distinguish `C24 Pocket Food` from
  `C24 Girokonto`. Guessing it wrong silently files a month of groceries under the rent pocket.
- `--file` — the export to read.
- `--dry-run` (add it) — parse, normalize, categorize, print the counts, insert nothing. This is
  what you run first against real data.

Reads `DATABASE_URL` from the environment, so the same script targets dev, test, or the Railway
database in 8a with no code change.

The whole thing in one transaction:

```python
with conn:                                   # commits on exit, rolls back on exception
    with conn.cursor() as cur:
        # 1. import row first — transactions.import_id references it.
        #    Counts start at 0; they aren't knowable until after the insert.
        cur.execute("""
            INSERT INTO imports (account_id, filename, row_count,
                                 statement_balance, statement_date)
            VALUES (%s, %s, %s, %s, %s) RETURNING id
        """, (account_id, filename, len(df), stmt_balance, stmt_date))
        import_id = cur.fetchone()[0]

        # 2. ON CONFLICT DO NOTHING turns the unique constraint into the
        #    dedupe mechanism. RETURNING id yields ONLY the rows that
        #    actually inserted — so len(result) IS inserted_count.
        inserted = execute_values(cur, """
            INSERT INTO transactions
              (account_id, import_id, date, raw_name, normalized_name, counterparty,
               external_id, amount, flow, category_id, category_source,
               category_confidence, dedupe_hash, dedupe_seq, source_file)
            VALUES %s
            ON CONFLICT (dedupe_hash, dedupe_seq) DO NOTHING
            RETURNING id
        """, rows, fetch=True)

        # 3. now the counts are known
        cur.execute("""
            UPDATE imports SET inserted_count = %s, skipped_count = %s WHERE id = %s
        """, (len(inserted), len(df) - len(inserted), import_id))
```

**`ON CONFLICT … DO NOTHING` is the entire dedupe implementation.** The Python computes the key;
Postgres enforces it. The constraint cannot be bypassed by a bug in a later script, by a manual
`psql` insert, or by the Phase 7 mobile import — which is exactly why this is a database constraint
and not an `if row in existing:` check.

`bp.py` also needs a small change: it currently discards the 7-line header with `skiprows=7`.
`Solde (EUROS)` and `Date` from that block are `imports.statement_balance` / `statement_date`, the
anchor Phase 6's reconciliation view needs. Read the header separately, then parse the body.

---

##### Integration test — `backend/test/import.test.ts`

The Vitest side asserts on the *result* of an import, using rows inserted directly (no Python in
the test path — the Python is covered by pytest).

```ts
test("re-importing the same file inserts nothing", async () => {
  const rows = sampleBpRows();                       // fixture, already hashed + sequenced
  const [imp1] = await db("imports").insert(
    { account_id: 1, filename: "sample_bp.tsv", row_count: rows.length }).returning("id");
  const ins1 = await db("transactions")
    .insert(rows.map((r) => ({ ...r, import_id: imp1.id })))
    .onConflict(["dedupe_hash", "dedupe_seq"]).ignore().returning("id");
  expect(ins1).toHaveLength(rows.length);

  const [imp2] = await db("imports").insert(
    { account_id: 1, filename: "sample_bp.tsv", row_count: rows.length }).returning("id");
  const ins2 = await db("transactions")
    .insert(rows.map((r) => ({ ...r, import_id: imp2.id })))
    .onConflict(["dedupe_hash", "dedupe_seq"]).ignore().returning("id");
  expect(ins2).toHaveLength(0);                      // ← the whole phase in one assertion
});

test("three identical rows all insert, via dedupe_seq", async () => { /* seq 0,1,2 */ });
test("same date + amount, different name → both insert", async () => { /* … */ });
```

**DoD 4c**
```bash
# sample, dry run
python3 backend/python/bank/db_insert.py --bank BP --account 1 --file data/sample/sample_bp.tsv --dry-run
# sample, for real
python3 backend/python/bank/db_insert.py --bank BP --account 1 --file data/sample/sample_bp.tsv
# again — this is the test
python3 backend/python/bank/db_insert.py --bank BP --account 1 --file data/sample/sample_bp.tsv
# the overlap file
python3 backend/python/bank/db_insert.py --bank BP --account 1 --file data/sample/sample_bp_overlap.tsv
```
```sql
SELECT filename, row_count, inserted_count, skipped_count FROM imports ORDER BY id;
```
Required output:

| filename | row_count | inserted_count | skipped_count |
|---|---|---|---|
| sample_bp.tsv | 12 | 12 | 0 |
| sample_bp.tsv | 12 | **0** | **12** |
| sample_bp_overlap.tsv | 8 | **3** | **5** |

Plus: `pytest` green, `npm test` green, and the three-identical-rows fixture present as three rows
with `dedupe_seq` 0, 1, 2. Repeat the whole sequence for C24 before moving on.

---

#### Phase 4d — Trade Republic
**0.75 session** · *Cut this first if a session is lost. Everything else is load-bearing.*

TR is not an investment account any more — it is the 2026 daily card (`ALDI SUED`, `REWE`,
`DM DROGERIE`, `SNCF-VOYAGEURS`, `Coffee Fellows`). Excluding it makes current-year totals wrong.

##### Files

```
backend/python/bank/tr.py                NEW    ~40 lines
backend/python/bank/db_insert.py         EDIT   --bank TR branch
backend/src/db/seeds/03_category_rules.ts EDIT  MCC block already written in 4b
data/sample/sample_tr.csv                READY  built in 4a.3
```

##### What differs from `bp.py` / `c24.py`

| Difference | Cost |
|---|---|
| Tab-delimited, real header row | 1 line |
| `M/D/YYYY` dates → `dayfirst=False` | 1 line |
| `.` decimal separator | 0 lines — simpler than the other two |
| Cash movement = `amount + fee + tax` (three separate columns) | 3 lines |
| Row-type filter on the `type` column | ~8 lines |

##### Row-type handling — the only real decision

| `type` | Treatment | Category |
|---|---|---|
| `CARD_TRANSACTION` | real spending | from `mcc_code` rule (priority 50) |
| `TRANSFER_*_INBOUND` | the receiving half of a BP/C24 transfer | `SAVINGS` (`transfer`) |
| `BUY` / `SELL` | **cash side only**: `amount + fee` as one row | `INVESTING` (`transfer`) |
| `CARD_ORDERING_FEE` | real cost | `OTHERS-outflow` |

A `BUY` moves cash out of the TR *cash* balance into securities — not spending. Importing the cash
side keeps the TR balance reconcilable while leaving expense totals clean. The €1 order fee is a
real cost and rides in the same row. No `shares` / `price` / `symbol` columns: that is portfolio
tracking, a different product.

##### Dedupe — the easy path

```python
dedupe_hash = row["transaction_id"]   # native stable UUID
dedupe_seq  = 0                       # always
```

No sha256, no collisions, and it is an **independent check on the 4c hash design**: if TR imports
cleanly twice and BP does not, the bug is in `compute_hash`, not in the constraint.

Flip `accounts.id = 6` to `is_tracked = true` in `01_accounts.ts` when this lands.

**DoD 4d:** `sample_tr.csv` imports; re-import inserts 0; a `CARD_TRANSACTION` with `mcc_code`
`5411` lands in `FOOD & Households` with `confidence = 0.90` and `category_confirmed_at IS NULL`;
a `BUY` row lands as one `INVESTING` transaction whose amount equals `amount + fee`.

---

#### Phase 4e — Real data + reconciliation
**0.5 session** · *Only start when 4c is boring against sample data.*

- [ ] Point `ETL_INPUT_DIR` at the real exports. **Read the path from the environment, never
      hardcode a relative path** — 8a runs this same script against the Railway database from a
      different working directory.
- [ ] `--dry-run` every real file first. Compare printed row counts against
      `wc -l <file>` minus the header.
- [ ] Import BP: 11 files, one `--account 1` run each. Expected across all of them:
      **1484 rows read, 832 inserted, 652 skipped.** Those numbers are measured, not estimated —
      if you land anywhere else, stop and diff before importing C24.
- [ ] Confirm the 26 within-file duplicates survived: rows with `dedupe_seq > 0` must number 26.
- [ ] Import C24: one run per account (`--account 2`…`5`), one file at a time.
- [ ] Re-run one deliberately overlapping BP export. `inserted_count` must be 0.
- [ ] Spot-check categorization: `SELECT count(*) FROM transactions WHERE category_id IS NULL`.
      Expect 30–40% uncategorized — that is the manual review queue Phase 5 exists to drain. If it
      is >70%, the normalizer is over-stripping; if it is <10%, a rule is matching too broadly.
- [ ] Sanity query, and the one that catches a wrong `--account`:
```sql
SELECT a.label, count(*), min(t.date), max(t.date), sum(t.amount)
FROM transactions t JOIN accounts a ON a.id = t.account_id
GROUP BY a.label ORDER BY a.label;
```

##### The BP 90-day gap — decided 2026-08-24

BP's CSV/TSV export reaches back only **90 days**. As of 2026-08-24 that covers
**2026-05-26 → 2026-08-24**, and the historical TSVs in `data/real/bp/tsv/` stop at 2025-04.
So roughly **2025-05 → 2026-05 has no machine-readable BP export** — including five months of
2026, which is exactly what makes Phase 6's yearly totals wrong.

C24 and TR are unaffected: both export the full 2026 range in one file.

**Fix for v1: a one-time manual conversion of the PDF statements** (option 2), with a real PDF
parser deferred to Phase 12.

- [ ] Transcribe the gap period from the PDF statements into **BP TSV format** — reuse
      `write_bp()` in `scripts/make_fixtures.py` rather than hand-typing a file, so the encoding,
      CRLF and 7-line header are right by construction. It then imports through the existing
      `bp.py` path with **zero new code**.
- [ ] Name it distinctly, e.g. `BP_MANUAL_2025-05_2026-05.tsv`, so `transactions.source_file`
      makes these rows identifiable later.
- [ ] **Cut the manual file at 2026-05-25 — one day before the real TSV coverage begins.**
      This is not cosmetic. `dedupe_hash` reads `raw_name`; a hand-transcribed payee string will
      not byte-match what BP's exporter would have produced, so any overlap between the manual
      file and a real export inserts the same transaction twice with different hashes. Since BP
      *cannot* export the gap period anyway, a clean cut makes overlap structurally impossible.
- [ ] If a duplicate does slip through, resolve it with `ignored_at`, never `DELETE`
      (see the M4 note — a hard delete frees the hash and the row returns on the next import).

**When is this data actually needed?** Not for 4a–4d: the sample fixtures cover all parser and
dedupe work. The ETL is incremental, so the gap file can be imported at any later point as just
another run — no rework. The deadline is **4e's reconciliation** and, hard, **Phase 6**, where a
missing five months makes the Overview lie. Best time to do the transcription is *during* 4b/4c:
it is manual work with no code dependency, so it parallelises with the build.

**⚠️ Before the first real import:** `git status` and confirm nothing under `data/real/` is staged.
The repo is public.

---

#### Phase 4 — done when

Importing the same file twice adds nothing the second time; the `imports` table shows honest
inserted/skipped counts; `npm test` runs against `db-unifin-test` and leaves the dev database
untouched; and `SELECT count(*) FROM transactions` returns 832 for BP with 26 rows carrying
`dedupe_seq > 0`.

**Deferred out of Phase 4 (recorded so it is not rediscovered):**
PayPal enrichment join (~0.5 session, post-launch) · rules learning-loop UI (Phase 5, already cut
in §5.0) · `recurring_series` (Phase 9) · `categories.parent_id` (only if the flat list starts
hurting).

**Learning outcome:** full Knex migration workflow including `alterTable`, FK design and reversible
`down()` migrations; unique constraints as a correctness guarantee rather than a formality; test
database isolation via injected env vars; and Python writing directly to Postgres with conflict
handling inside a single transaction.

---

### Phase 8a — Deploy early
**Layer:** DevOps · **Stack:** Railway, Vercel · **Estimate:** 2 sessions · **Weeks 2–3**

*Ship it while it is still small. At this point the app is "login + a table of transactions" —
which is exactly the right size for a first deploy.*

- [ ] Railway project: PostgreSQL service + backend service from `backend/Dockerfile`
- [ ] Run migrations against the Railway DB (`knex migrate:latest` with the prod `DATABASE_URL`)
- [ ] Railway env vars: `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `PORT` — **new secrets for prod, never the dev ones**
- [ ] Railway healthcheck → `GET /health` (from Phase 3)
- [ ] CORS on the backend: allow the Vercel origin — in dev the Vite proxy hides this, in prod it does not
- [ ] Vercel project from `frontend/`, set `VITE_API_URL` → the Railway backend URL
- [ ] Frontend `api/*.ts`: swap relative `/api/...` for `` `${import.meta.env.VITE_API_URL}/api/...` ``
- [ ] Load real data into the prod DB: run `db_insert.py` against the Railway `DATABASE_URL`
- [ ] Smoke test from the phone browser: log in, see transactions

**8a done when:** there is a URL you can open on your phone, log into, and see your real
transactions on. Deploy is still manual (`git push` → Railway/Vercel auto-build); the
Actions pipeline comes in 8b.

**Learning outcome:** the gap between "works in Docker Compose" and "works in prod" — CORS,
env var management across two platforms, and running migrations against a database you can't
`docker exec` into.

### Phase 5 — Transactions UI + manual categorization
**Layer:** Full-stack · **Stack:** Express (PATCH routes), Knex, React (controlled inputs) · **Estimate:** 3 sessions · **Weeks 3–4**

*The core editing loop — this is where the app replaces the spreadsheet.*

- [ ] `GET /transactions` — filterable by `account_id` / date range / `flow` / `category_id` / `uncategorized` / `q`. **No pagination** — ~1000 rows, send them all.
- [ ] `TransactionsPage`: table — Date · Bank · Name · Amount · Category. Bank comes from the `accounts` join.
- [ ] Account filter: All / BP / C24
- [ ] Inline category dropdown → `PATCH /transactions/:id { category_id }`, which also sets `category_source = 'manual'` and `category_confirmed_at = now()` server-side
- [ ] Optimistic update: set the new category in React state immediately, roll back on a failed response — the alternative is a visible lag on every single click, several hundred times
- [ ] "Uncategorized" filter — one click to `category_id IS NULL`
- [ ] Rows where `category_confirmed_at IS NULL` render visually distinct (dashed chip border) — a rule-matched guess is not a decision. This is the same treatment Phase 10's AI suggestions will reuse.
- [ ] Search box over `normalized_name` — `ILIKE '%q%'`, debounced ~300ms on the input so it doesn't fire a request per keystroke

**Deferred:** pagination; the rules learning loop ("always categorize this as X" → new
`category_rules` row). For now, edit the `category_rules` table directly and re-import.

**5 done when:** you can find any transaction across both banks in under 5 seconds and
categorize it in one click.

**Learning outcome:** PATCH endpoints, controlled React inputs, optimistic UI updates with
rollback, debounced search input.

### Phase 6 — Overview + balances + reconciliation
**Layer:** Full-stack · **Stack:** Knex/SQL aggregation, React · **Estimate:** 4.5 sessions · **Weeks 4–5**

*Excel parity, plus the thing Excel never told you: whether the numbers are actually complete.*

#### Overview

- [ ] `GET /overview?year=YYYY&account_id=` → `{ category, type, total }[]` grouped by category
- [ ] **Transfer exclusion:** every aggregate excludes `categories.type = 'transfer'`. A €500 BP→C24 transfer otherwise counts as both an expense and an income, and every total on the page is wrong. Cheap to write, essential to verify — check one known transfer by hand.
- [ ] `OverviewPage`: year selector, category totals table, INFLOW / OUTFLOW / NET split
- [ ] Month breakdown: same query grouped by month
- [ ] Account filter: one bank or all

#### Balances + reconciliation

- [ ] `GET /accounts/balances` → per account: `opening_balance + SUM(amount)` = computed balance, plus the latest `imports.statement_balance` and the delta
- [ ] Balance cards on the Dashboard: one per account (BP, C24) + a combined total. **Transfers are included here** — unlike the overview totals. A transfer genuinely moves money out of one account and into the other; it's only the *category* aggregates where counting it twice is wrong. Worth writing down, because it looks like an inconsistency and isn't.
- [ ] `ReconciliationPage`: per account, the computed balance vs. the bank's stated balance, delta highlighted — green when 0, red when not
- [ ] Delta drill-down: when a delta is non-zero, list that account's transactions around the statement date so the gap can be found by eye
- [ ] Transfer pairing: match outgoing/incoming rows across accounts (same amount, opposite sign, ≤3 days apart) → populate `transfer_pair_id`. Flag unpaired transfer-category rows — money that left one account and never arrived is exactly the failure the pairing exists to catch.

**Deferred:** drill-down from a category total to its transactions (search + category filter
covers most of it).

**6 done when:** both account balances reconcile to €0.00 delta against a real statement —
or the delta is explained.

**Learning outcome:** SQL aggregation via Knex, `GROUP BY` with conditional exclusion, derived
data in React without extra state, and the difference between "the numbers add up" and "the
numbers are complete".

### Phase 8b — CI/CD + ship v1.0.0
**Layer:** DevOps · **Stack:** GitHub Actions, Railway, Vercel · **Estimate:** 1.75 sessions · **Week 5**

*8a made it live by hand. 8b makes it automatic and tags the release.*

- [ ] GitHub Actions: lint → frontend tests (Vitest) → backend tests (Supertest) against a **Postgres service container**, running migrations against it first and using the sample fixtures only
- [ ] On green `main`: auto-deploy → Railway (backend) + Vercel (frontend)
- [ ] Confirm no real transaction data ever appears in Actions logs
- [ ] Production smoke test: log in → transactions load → categorize one → overview totals update → reconciliation shows €0.00 delta
- [ ] README: screenshots, stack, "real bank files not included — use your own or the sample fixtures"
- [ ] Tag `v1.0.0`

**Learning outcome:** a full CI/CD pipeline with an ephemeral database service — the single
most transferable thing in this repo, and the piece CREA forks verbatim.

---

## 5b. Post-launch backlog

*Everything below ships as an update to the already-running app. No phase here blocks `v1.0.0`.*

### Phase 7 — Mobile + file import from UI
**Layer:** Full-stack · **Stack:** Express (multer, child_process), React (responsive Tailwind) · **Estimate:** 5 sessions

*Makes the app usable on the phone, and removes the manual terminal step from importing.*

- [ ] `POST /import` endpoint: file upload (multer), Node spawns Python `db_insert.py` via `child_process` — **read the security contract below before writing a line of it**
- [ ] `ImportPage`: file picker **+ drag-and-drop** (`onDragOver` / `onDrop` + `e.dataTransfer.files` — ~20 lines on top of the picker), bank selector (BP / C24)
- [ ] Import result feedback surfaces the dedupe counts from the `imports` row: `"312 rows · 47 new · 265 duplicates skipped"`
- [ ] Transactions table → mobile card list (`useIsMobile()` hook, same pattern as portfolio)
- [ ] Category dropdown usable on mobile (native `<select>` or bottom sheet)
- [ ] Overview + reconciliation readable on a small screen
- [ ] Test on a real device

#### Security contract for `POST /import` (written 2026-08-18)

**`ETL_INPUT_DIR` and the upload are two different code paths.** The env var is only where the
*CLI* looks for files when you run it from a terminal (Phase 4e, 8a). It is a directory path, not a
secret, and it never holds file contents. An uploaded file never touches it:

```
Terminal (4e/8a):  you → db_insert.py --file $ETL_INPUT_DIR/bp_march.tsv → Postgres
App upload (7):    browser → POST /api/imports (multipart)
                           → multer writes to os.tmpdir()/<uuid>.tsv
                           → spawn("python3", ["db_insert.py", "--file", tmpPath, …])
                           → delete tmp file
                           → respond with the imports row counts
```

Eight rules. The first two are the ones that turn a personal tool into a remote shell if you get
them wrong:

1. **`spawn` with an argv array, never `exec` with a template string.** `exec` runs the command
   through `/bin/sh`, so a filename containing `; rm -rf /` executes. `spawn("python3", [...])`
   passes argv straight to the kernel — there is no shell to inject into.
   ```ts
   // ✗ shell injection
   exec(`python3 db_insert.py --file ${path} --bank ${bank}`);
   // ✓ no shell involved
   spawn("python3", ["db_insert.py", "--file", path, "--bank", bank], { timeout: 30_000 });
   ```
2. **Never build a path from `req.file.originalname`.** A browser can send
   `../../../app/.env` as a filename. Generate the temp name yourself
   (`crypto.randomUUID()`); keep the original only as a display string in `imports.filename`.
3. **Route behind `requireAuth`.** Single user, existing middleware, non-negotiable.
4. **Validate `--account` server-side.** It is an integer from the client. `SELECT 1 FROM accounts
   WHERE id = ?` before spawning, or a typo files a month of groceries against an arbitrary id.
5. **Cap size and extension** — `multer({ limits: { fileSize: 5 * 1024 * 1024 } })` and reject
   anything that is not `.csv` / `.tsv`. A 4 GB upload is a one-request DoS on a Railway free-tier
   container. Extension checking is *not* security, it is a sanity filter; the real guard is 1–3.
6. **Temp dir outside the repo and outside anything served.** `os.tmpdir()`, deleted in a
   `finally` so a parse crash does not leave bank data on disk. Railway's filesystem is ephemeral
   anyway, which helps.
7. **Timeout the spawn** (`{ timeout: 30_000 }`) and cap stdout. A malformed CSV can make pandas
   sit forever, and a hung child holds a connection open.
8. **Never pass file contents through an environment variable.** Env is capped around 128 KB
   (`ARG_MAX`), readable by any process in the container via `/proc/<pid>/environ`, and routinely
   captured by platform logging. Files go on disk or through stdin. Env holds *configuration*.

On secrets generally: `ETL_INPUT_DIR` is a path and needs no protection. The variables that are
actually secret are `DATABASE_URL`, `JWT_SECRET` and `ADMIN_PASSWORD_HASH` — gitignored in
`backend/.env`, set as Railway variables in prod, and **different values in prod than in dev** (8a).

**Learning outcome:** file upload in Express, `child_process` Python interop (watch the venv
and path handling inside Docker), the shell-injection boundary between `exec` and `spawn`,
responsive Tailwind layout.

---

### Phase 9 — Recurring / subscription detection
**Layer:** Full-stack · **Stack:** Knex, SQL, React · **Estimate:** 3 sessions

- [ ] Migration: `recurring_series` (id, account_id, normalized_name, expected_amount, cadence_days, last_seen_date, next_expected_date, is_active, category_id) + `transactions.recurring_series_id`
- [ ] Detection service: group by `normalized_name` with amounts within ±5%, compute date deltas, flag anything with ≥3 occurrences at a stable cadence
- [ ] Backfill `transactions.recurring_series_id`
- [ ] Dashboard panel: "Fixed costs: €X/month", listed
- [ ] Flag a series where `next_expected_date` has passed with no matching transaction — either it was cancelled, or the import is incomplete

---

### Phase 10 — AI categorizer
**Layer:** Full-stack · **Stack:** Anthropic API (Haiku 4.5), Express, React · **Estimate:** 4.5 sessions

*Sits on top of the rules engine, never replaces it. Rules are free, deterministic and instant;
the AI only sees what the rules missed.*

- [ ] Endpoint touches only rows where `category_id IS NULL` after rules have run
- [ ] Batch by **distinct `normalized_name`**, ~50 per call — you are classifying payees, not rows. ~900 uncategorized transactions collapse to ~200 distinct names.
- [ ] Structured output → `{ normalized_name, category, confidence }`, written as `category_source = 'ai'`, `category_confidence = <n>`, `category_confirmed_at = NULL`
- [ ] Review UI: AI rows render with the same "unconfirmed" treatment built in Phase 5, plus the confidence value. Per-row accept / edit, plus **"Validate all above 0.85"** as a bulk action → `PATCH /transactions/confirm { ids: [...] }`
- [ ] Accepting a suggestion keeps `category_source = 'ai'` and only sets `confirmed_at` — that's what makes "how often was the AI right?" answerable later
- [ ] Cost guard: cap the rows sent per run, log token usage

Cost at this data volume is a few cents, one-time. Not a factor in the design.

---

### Phase 11 — Multiple export formats per bank
**Layer:** ETL · **Stack:** Python · **Estimate:** 2 sessions · *Post-launch*

*v1 supports exactly one file format per bank (BP `.tsv`, C24 comma `.csv`, TR `.csv`). Every
bank offers more, and the format you happen to click in the export dialog should not decide
whether the import works.*

Inventory taken 2026-08-24 from `data/real/temp/20260824/`:

| Bank | v1 | Also available | Notes |
|---|---|---|---|
| BP | `.tsv` | `.csv` (ISO-8859-1, CRLF), `.ofx` | OFX is a structured XML-ish standard — arguably a *better* source than the TSV, and it carries an `FITID` (a real `external_id`, so no hashing) |
| C24 | comma `.csv` | semicolon `.csv`, `.xlsx` | Same 14 columns, delimiter differs. `.xlsx` needs `openpyxl` |
| PayPal | — | `.CSV`, `.PDF` | Stays an *enricher*, never an account — see the 4e note |

Design, in order of value:

- [ ] **Sniff the format, don't ask.** One `detect_format(path)` returning `(bank, variant)` from
      the byte signature — BOM present, first-line delimiter counts, header names — rather than a
      `--format` flag. The filename is not evidence; the user renames files.
- [ ] **Delimiter detection for C24** — `csv.Sniffer` on the header line, or simply count `,` vs
      `;`. This is the cheapest win: same parser, one parameter.
- [ ] **`c24.py` hardening (some of this lands early, in 4c)** — pass `encoding="utf-8-sig"`
      explicitly, strip `€`/NBSP before the comma→dot swap, stop hardcoding `delimiter=","`.
- [ ] **BP OFX parser** — if `FITID` proves stable across exports, OFX becomes the preferred BP
      source and `dedupe_hash` is bypassed entirely for that bank. Verify stability against two
      overlapping exports **before** trusting it.
- [ ] **One fixture per variant**, generated by `scripts/make_fixtures.py`. The generator already
      being the single source of format truth is what makes this cheap to add.
- [ ] Dedupe must hold **across formats**: the same transaction imported once as `.tsv` and once
      as `.csv` has to collide. That is a real assertion, and it constrains what may go into the
      hash — anything format-specific (quoting, padding, column order) must be normalized out
      *before* hashing, while still not touching `raw_name`.

The last bullet is the one with teeth. Everything else is parser plumbing.

---

### Phase 12 — BP PDF statement parser
**Layer:** ETL · **Stack:** Python (`pdfplumber`) · **Estimate:** 1–1.5 sessions · *Post-launch*

*Replaces the one-time manual transcription from 4e with something repeatable. BP's CSV/TSV
export only reaches back 90 days; the PDF statements are the only machine-readable source for
anything older, and the same gap reopens every time more than 90 days pass between exports.*

- [ ] `pdfplumber` table extraction per statement page; BP statements are a fixed-layout table,
      not free text, so `extract_table()` should carry most of it.
- [ ] **Emit BP TSV, do not insert directly.** The parser's output goes through the existing
      `bp.py` → `db_insert.py` path, so dedupe, categorization and `imports` bookkeeping are
      unchanged and the new code has exactly one job.
- [ ] The hard part is `raw_name` fidelity: for a PDF-sourced row to dedupe against a TSV-sourced
      one, the payee string must reproduce the exporter's spacing byte-for-byte — including the
      16-space `CARTE NUMERO` padding. Verify against a period covered by **both** a PDF and a
      TSV export; that overlap is the only real test.
- [ ] If byte-fidelity proves unachievable, the fallback is to treat PDF-sourced rows as their own
      non-overlapping date range (the 4e cut-date rule), which is what v1 does anyway.
- [ ] Statement `Solde` / `Date` per PDF feed `imports.statement_balance` / `statement_date` —
      free reconciliation anchors that the TSV export also provides.

Worth doing only once the app is live and the manual fill has proven annoying twice.

---

### v2 backlog — not scoped, not scheduled

| Feature | Note |
|---|---|
| **Steuer page** | Werkstudent tax view. Cheap architecturally: a `category_id → steuer_bucket` mapping table + a year filter, reusing Phase 6's aggregation. Needs receipts/export to be genuinely useful. |
| **Settings page** | Runtime config for accounts, categories, rules — currently all `.env` + direct SQL |
| **PSD2 / direct bank sync** | GoCardless Bank Account Data. Biggest scope by far: consent flow, mandatory 90-day re-authorization, token storage, a sync job, and dedupe against manual imports. A whole phase of its own. |
| **Split transactions** | One €80 supermarket run = €60 food + €20 household. Needs a `transaction_splits` table, and **every aggregation query changes** — the one deferred item with a real retrofit cost. |
| **Receipt attachments** | Feeds the Steuer page (German tax wants Belege). Reuses Phase 7's upload. |
| **CSV / PDF export** | Trivial, and what makes the Steuer page actually usable |
| **Budgets + alerts** | Explicitly rejected for now — this is a tracker, not a planner |
| **Multi-currency** | Not needed. EUR/EUR. |

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

## 9. Remaining work (as of 2026-08-10)

**Done:** Phases 1 (1a/1b/1c) and 2 (2a/2b). Repo created, `.gitignore` confirmed, Docker Compose
running, Knex wired, transactions CRUD, JWT auth end to end, 24 Vitest/RTL tests + Cypress e2e.

**Next, in order — see §5.0 for the full schedule:**

1. **Week 1** — Phase 3 (`/health`, Vite proxy, `<RequireAuth>`, logout) · migrations M1–M4 · **create the sample fixtures** (still missing, blocks Phase 4 and CI)
2. **Week 1, offline** — look up the real opening balance + date for BP and C24 from a statement (needed by `accounts`, and by Phase 6's reconciliation)
3. **Week 2** — seed accounts/categories/rules · `db_insert.py` rewrite with normalize + hash + seq · verify on sample then real · start Railway
4. **Week 3** — Phase 8a: live on Railway + Vercel · Phase 5 `GET /transactions` + table
5. **Week 4** — Phase 5: inline category PATCH, uncategorized filter, search · start Phase 6 aggregation
6. **Week 5** — Phase 6: balance cards, reconciliation view, transfer exclusion · Phase 8b: Actions pipeline, smoke test, **tag `v1.0.0`**

Then: Phase 7 (mobile + import UI) → Phase 9 (recurring) → Phase 10 (AI categorizer), each
deployed as an update to the running app.
