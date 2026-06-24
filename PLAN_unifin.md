# Unifin — Bank Tracker · Development Plan

> Working document. Living plan for `bank-tracker` (Unifin).
> Created: 2026-06-22. Last updated: 2026-06-24.

---

## 1. Context & strategy

Unifin is the **second rung of a 3-project learning ladder**:

| Project | Role in the ladder | Stack |
|---|---|---|
| **Portfolio** (`coquardbalthazar.github.io`) | Done. Learned Vite + React + TS + GitHub Actions → GH Pages. | React + Vite + TS |
| **Unifin** (this repo) | Step up. Same frontend + first real backend: Express + PostgreSQL + JWT + Docker. Personal use → solo auth. | React + Vite + TS + Node/Express + PostgreSQL + Docker |
| **CREA** | Main project. Multi-user, groups, chat, AI coach. Forks this repo's skeleton. | Full-stack (same, + realtime) |

**Build order:** Bank Tracker v0 → ships → (apply for SE Werkstudent roles) → extract `fullstack-starter` GitHub template → CREA v0 → continue applying with stronger profile.

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
bank-tracker/
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

### Phase 1 — Skeleton
*The boring 60% that CREA inherits. Build it right once.*

- [ ] Create repo `bank-tracker` on GitHub (start private, make public once gitignore confirmed)
- [ ] `.gitignore` — first thing written: `data/real/`, `backend/.env`, `frontend/.env`, `CLAUDE.local.md`
- [ ] `docker-compose.yml` — two services: `app` (Node) + `postgres`
- [ ] Backend: `npm init`, Express + TypeScript, `ts-node-dev`, `GET /health` route
- [ ] Knex setup: `knex.ts` config, first migration (`accounts` table), `npm run migrate`
- [ ] JWT auth: `POST /auth/login` (credentials from `backend/.env`), `POST /auth/me`, auth middleware
- [ ] Frontend: `npm create vite@latest` (React + TS), Tailwind setup, proxy → backend
- [ ] React auth shell: LoginPage, auth context, `useAuth` hook, protected route wrapper
- [ ] GitHub Actions CI: lint + build on push
- [ ] Confirm full loop: login → protected page → `GET /health` with token → 200

**Learning outcome:** Docker Compose, Express + TS, Knex migrations, JWT end-to-end, React auth context, Tailwind. This is the CREA skeleton.

### Phase 2 — Database schema + ETL
*Migrations for the remaining tables. Python ETL writes to Postgres.*

- [ ] Migrations: `transactions`, `categories`, `category_rules`
- [ ] Seed script: populate `categories` from existing taxonomy, using `data/sample/`
- [ ] Extend Python ETL: `db_insert.py` writes normalized rows to `transactions` (instead of CSV)
- [ ] `backend/.env.example`: `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`
- [ ] Verify: run `db_insert.py` with sample fixture → check row count + dates + amounts in DB

**Learning outcome:** full Knex migration workflow, seeding, Python writing directly to Postgres.

### Phase 3 — Transactions UI
*The core editing loop — this is where the app becomes useful.*

- [ ] `GET /transactions` — paginated, filterable by account / date range / flow / category
- [ ] `TransactionsPage`: table — Date · Bank · Name · Amount · Category
- [ ] Inline category dropdown: `PATCH /transactions/:id` `{ category_id }`
- [ ] "Uncategorized" filter — one click to see only `category_id = NULL`
- [ ] Auto-categorize on import: match `raw_name` against `category_rules`
- [ ] Rules learning loop: manual override → offer "always categorize this as X" → new `category_rules` row

**Learning outcome:** PATCH endpoints, controlled React inputs, optimistic UI updates.

### Phase 4 — Overview
*The yearly dashboard. Pure SQL + simple React.*

- [ ] `GET /overview?year=YYYY` → `{ category, type, total }[]` grouped by category
- [ ] `OverviewPage`: year selector, category totals table, INFLOW / OUTFLOW split
- [ ] Drill down: click a category total → transactions feeding it (source traceability)
- [ ] Month breakdown: same query grouped by month
- [ ] Account filter: one bank or all

**Learning outcome:** SQL aggregation via Knex, derived data in React without extra state.

### Phase 5 — Mobile + file import from UI
*Makes the app actually usable on the phone during downtime.*

- [ ] `POST /import` endpoint: file upload (multer), Node spawns Python `db_insert.py` via `child_process`
- [ ] `ImportPage`: file picker, bank selector (BP / C24), upload button, result feedback
- [ ] Transactions table → mobile card list (`useIsMobile()` hook, same pattern as portfolio)
- [ ] Category dropdown usable on mobile (native `<select>` or bottom sheet)
- [ ] Overview readable on small screen
- [ ] Test on real device

**Learning outcome:** file upload in Express, `child_process` Python interop, responsive Tailwind layout.

### Phase 6 — CI/CD + deploy
*Ship it. Same pipeline CREA will use.*

- [ ] GitHub Actions: lint → test (sample data) → Docker build → deploy to Railway
- [ ] PostgreSQL on Railway
- [ ] Frontend on Vercel — connect repo, set `VITE_API_URL`
- [ ] All secrets in Railway + Vercel dashboards — never in repo
- [ ] Smoke test on production: import sample → categorize → overview

**Learning outcome:** full CI/CD, environment management across two platforms.

### Phase 7 — Template extraction (bridge to CREA)
*The handoff.*

- [ ] Tag `v1.0.0`
- [ ] Create `fullstack-starter` private repo: strip ETL, transactions routes, categories — keep auth, Docker, CI/CD, Express scaffold, React shell, Knex, Tailwind
- [ ] Mark as GitHub Template Repository
- [ ] CREA starts from "Use this template"

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

1. Create repo `bank-tracker` on GitHub
2. Write `.gitignore` first — `data/real/`, `backend/.env`, `frontend/.env`, `CLAUDE.local.md`
3. Create synthetic sample fixtures (`data/sample/sample_bp.tsv`, `data/sample/sample_c24.csv`)
4. Answer the one remaining open question: Python ETL called via `child_process` from Phase 5 — confirm that's the plan (yes)
5. Start Phase 1
