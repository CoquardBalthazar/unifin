# Unifin — bank-tracker

## What this project is

Personal bank transaction tracker. **Second rung of a 3-project learning ladder:**
Portfolio (done) → Unifin / Bank Tracker (this) → CREA (full-stack, multi-user).

The skeleton built here (auth, Docker, Express, Knex, React shell) is the template CREA forks from.
Build order decided: Bank Tracker v0 → ships → apply for SE Werkstudent roles → extract `fullstack-starter` template → CREA v0.

## Stack

- **Frontend:** React + Vite + TypeScript (matches portfolio + CREA)
- **Styling:** Tailwind CSS (new project, no existing design system to preserve — faster to build, industry standard)
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL via Knex.js (migrations + query builder — Knex ≈ Alembic in Python)
- **Auth:** JWT, single user — credentials in `backend/.env`, no registration endpoint
- **ETL:** Python (existing `bp.py`, `c24.py` — extended to write to Postgres via `db_insert.py`)
- **Dev:** Docker Compose (app + postgres services)
- **CI/CD:** GitHub Actions → Railway (backend + DB) + Vercel (frontend)

## Decisions made — locked

| Decision | Choice | Reason |
|---|---|---|
| Styling | Tailwind | New project, no existing design system, industry standard |
| Deploy: backend + DB | Railway | Free $5/month credit covers a small app, DB doesn't pause, better DX than Render |
| Deploy: frontend | Vercel | Zero-config Vite support, auto preview URLs per PR, env vars handled cleanly |
| `.env` structure | Separate `backend/.env` + `frontend/.env` | Backend secrets never bleed into frontend even by accident |
| Auth | Single hardcoded user in `backend/.env` | Personal tool, no registration needed, same JWT pattern CREA will use |
| ETL integration (v0) | Manual step — run Python from terminal | Zero overhead, unblocks Phase 2 immediately; switch to `child_process` in Phase 5 for mobile import |
| ETL integration (v1) | Node `child_process` spawns Python | Enables import from phone UI — added in Phase 5 |

## How we work together on this project — READ BEFORE EVERY TASK

### Commands — I type these myself

Never run terminal commands on my behalf. Write the command, explain what it does in one line,
then stop and wait for me to run it and report back.
Exception: read-only inspection commands (`ls`, `cat`, `find`, `grep`, `git status`, `git log`) are always fine to run without asking.

### Pace

When I say "it's done" or "done", that means I already created the file/folder myself.
Don't re-explain what was just done — verify with a quick read-only command if needed, then move to the next step immediately.

### I am here to learn, not to watch you build

- **Never build a full feature in one shot.** Break every task into the smallest meaningful step, then stop and wait.
- **Explain before you code.** One short paragraph on what we're about to do and why, then the code.
- **One file or one concept at a time.** If a task touches multiple files, do them one by one.
- **Always stop and ask me to confirm** before moving to the next step.
- **If I'm about to copy-paste without understanding**, flag it and explain the piece I'm missing first.

### Calibrate explanations to this

Strong in: Python, SQL, Git, Linux/WSL, data pipelines, Docker basics.
New to: Express/Node, Knex, JWT implementation, Tailwind, React beyond portfolio basics.
→ Explain Node/Express/Knex patterns as if I know backend concepts but am new to the JS ecosystem.
→ Python analogies always welcome: Knex migrations ≈ Alembic, middleware ≈ decorators, services ≈ functions your view calls.
→ Don't over-explain Git, CLI, or Docker Compose structure.

### Architecture — what each layer does

```
HTTP Request
     ↓
Middleware      ← runs before every route (auth check, error handling)
     ↓
Route           ← maps URL + method to a controller
     ↓
Controller      ← handles req/res, validates input, calls service
     ↓
Service         ← business logic (categorize, import, aggregate) — no req/res here
     ↓
Database (Knex)
```

Pages vs Components (frontend):
- **Pages** = full screens (TransactionsPage, OverviewPage, ImportPage, LoginPage)
- **Components** = reusable pieces used inside pages (TransactionRow, CategoryDropdown, FilterBar, NavBar)

### Feedback style

Direct and blunt. If my code is wrong or my approach is bad, say so clearly. No padding.

### On multi-part requests

When I drop a large request (multiple features at once), lock build order and ambiguous decisions
first via one round of questions — then build. Don't start coding on assumptions.

## Current phase

See `PLAN_unifin.md` for the full phased plan. Always check which phase is active before starting a task.

**Build order (locked 2026-08-10): Phase 3 → 4 → 8a → 5 → 6 → 8b → `v1.0.0`.**
Note the deploy split: 8a puts the app live in week 3, when it's still small.
Phases 7 (mobile), 9 (recurring) and 10 (AI categorizer) are post-launch, shipped as updates.

**Current status: Phases 1, 2 and 3 complete (frontend shell + routing + tests, Docker, Knex,
Express CRUD, JWT auth, AuthContext + RequireAuth, Vite `/api` proxy, `GET /health`).
Phase 4 active — planned in detail 2026-08-18 as 4a→4e. Target: deployed `v1.0.0` by
mid-September 2026.**

## Project structure (target)

```
unifin/
├── backend/
│   ├── src/
│   │   ├── routes/         # URL + method → controller mapping
│   │   ├── controllers/    # req/res handling, input validation
│   │   ├── services/       # business logic, DB calls — testable without HTTP
│   │   ├── db/
│   │   │   ├── knex.ts     # Knex instance + connection config
│   │   │   └── migrations/ # one file per schema change, append-only
│   │   ├── middleware/     # auth.ts (JWT check), error.ts
│   │   └── index.ts        # Express app entry point
│   ├── etl/                # Python scripts: bp.py, c24.py, db_insert.py
│   ├── .env                # ❌ gitignored
│   ├── .env.example        # ✅ committed — placeholder values
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # reusable UI pieces
│   │   ├── pages/          # ImportPage, TransactionsPage, OverviewPage, LoginPage
│   │   ├── api/            # typed fetch wrappers (one file per resource)
│   │   ├── hooks/          # useAuth, useIsMobile, useTransactions...
│   │   └── main.tsx
│   ├── .env                # ❌ gitignored
│   ├── .env.example        # ✅ committed
│   └── vite.config.ts
├── data/
│   ├── sample/             # ✅ committed — synthetic fixtures only
│   │   ├── sample_bp.tsv
│   │   └── sample_c24.csv
│   └── real/               # ❌ gitignored — never committed
├── docker-compose.yml
├── .gitignore
├── .github/
│   └── workflows/
│       └── ci.yml
├── CLAUDE.md
├── CLAUDE.local.md         # ❌ gitignored
└── PLAN_unifin.md
```

## Key constraints

- **Banking data is never committed.** `data/real/`, `backend/.env`, `frontend/.env` gitignored before first `git add`. Confirm before every commit.
- Sample fixtures in `data/sample/` are synthetic (fake names, rounded amounts) — safe to commit and used by CI.
- Single-user auth for v0 — no registration endpoint, one set of credentials in `backend/.env`.
- Python ETL stays in Python. Never rewrite `bp.py` / `c24.py` in JS.
- Migrations are append-only history. Never edit a migration that has already run — create a new one.

## Schema (source of truth)

```
accounts        — id, bank, account_type, currency, label,
                  opening_balance, opening_balance_date, is_tracked
transactions    — id, account_id, import_id, date, raw_name, normalized_name,
                  counterparty, external_id, amount, flow,
                  category_id (nullable), category_source, category_confidence,
                  category_confirmed_at, dedupe_hash, dedupe_seq,
                  transfer_pair_id, ignored_at, ignored_reason,
                  source_file, imported_at
categories      — id, label, type (income/expense/transfer), visible
category_rules  — id, bank, match_field, match_type, pattern,
                  category_id, priority, confidence
imports         — id, account_id, filename, row_count, inserted_count,
                  skipped_count, statement_balance, statement_date, imported_at
```

Full column list, reasoning and migration code live in **PLAN_unifin.md → Phase 4b**.

Non-obvious invariants — break these and Phase 6's totals lie:
- `UNIQUE(dedupe_hash, dedupe_seq)` is the duplicate-rejection mechanism. `dedupe_hash` is computed
  from **`raw_name`, never `normalized_name`** (improving the normalizer would invalidate every
  historical hash). `dedupe_seq` numbers identical rows within one import file.
- **Never hard-delete a transaction.** `DELETE` frees its `(dedupe_hash, dedupe_seq)`, so the next
  import of any overlapping export re-inserts it. Removal is `ignored_at = now()`; every aggregate
  filters `WHERE ignored_at IS NULL`. `ignored_at` is orthogonal to the `category_*` columns.
- `account_id` is chosen **per import file** (`--account` CLI flag), never derived from a row.
  C24 *does* ship a `Kontoname` column (corrected 2026-08-24) — use it as a **guard, not a source**:
  assert every row in a file shares one `Kontoname` and fail loudly on mismatch. Importing the
  Food pocket under `--account girokonto` is otherwise silent and poisons Phase 6 permanently.
- Every internal-transfer category is `type = 'transfer'` (SAVINGS, INVESTING, BALU, C24 pockets).
- `category_confirmed_at IS NULL` means "the app guessed, you haven't looked" — orthogonal to
  `category_source`.
- No `Uncategorized` category row; `category_id IS NULL` is uncategorized.
