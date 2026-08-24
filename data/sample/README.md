# `data/sample/` — synthetic bank-export fixtures

**Do not edit these files by hand.** They are generated:

```bash
python3 scripts/make_fixtures.py
```

Every file here is fake content in a **byte-faithful real format**. Names, amounts and account
numbers are invented; encoding, line endings, header block, column set and quoting are copied
verbatim from real exports (verified 2026-08-24 against `data/real/temp/20260824/`, gitignored).
That split is the whole point: a fixture with the wrong format exercises none of the parsing code
that actually breaks.

Editing a `.tsv`/`.csv` directly will silently revert its encoding — VS Code normalizes line
endings on save and git's `core.autocrlf` can rewrite them in transit. Change
`scripts/make_fixtures.py` and regenerate.

## Files

| File | Format | Purpose |
|---|---|---|
| `sample_bp.tsv` | ISO-8859-1, CRLF, tab | La Banque Postale parser |
| `sample_bp_overlap.tsv` | same | re-import / dedupe: 3 new + 5 byte-identical |
| `sample_c24.csv` | UTF-8 **+ BOM**, **LF**, comma | C24 Bank parser |
| `sample_c24_overlap.csv` | same | re-import / dedupe: 3 new + 4 byte-identical |
| `sample_tr.csv` | UTF-8 no BOM, LF, comma, all fields quoted | Trade Republic parser (Phase 4d) |

### Verify after regenerating

```bash
file --mime-encoding data/sample/*        # iso-8859-1 / utf-8 / utf-8
head -c 3 data/sample/sample_c24.csv | xxd   # must read: efbb bf
```

Use `--mime-encoding`, not bare `file`: `file` runs a structural test first and will report
`CSV text` for a well-formed CSV without ever mentioning the encoding.

## Why the weird-looking rows exist

Several rows look like mistakes. They are not. Each one is the only thing testing a specific
failure. **If you delete one, the corresponding bug becomes invisible.**

### `sample_bp.tsv`

| Row | Looks like | Actually proves |
|---|---|---|
| 3 × identical `BEER KING` rows, same date + amount | a copy-paste error | `dedupe_seq` → 0, 1, 2. Three genuine beers on one night are byte-identical in a BP export; a plain `UNIQUE(dedupe_hash)` would insert one and silently drop €26. Real exports contain 26 such rows. |
| `SAMPLE BAKERY` and `SAMPLE KIOSK`, same date **and** same amount | redundant | the hash reads `raw_name`, so both must insert with `dedupe_seq = 0`. Paired with the `BEER KING` rows this pins down exactly which fields the hash reads. |
| `CAFÉ DES ARTS` | a stray accent | **the ISO-8859-1 canary.** Byte `E9`, not `C3 A9`. Pure-ASCII data is byte-identical in Latin-1 and UTF-8, so without an accent `file` reports UTF-8 and the encoding test proves nothing. Wrongly decoded this renders `CAFÃ‰`. |
| `CARTE NUMERO` followed by 16 spaces | sloppy padding | verbatim from the real export. `normalize.py` must strip it, and `dedupe_hash` reads the unstripped `raw_name`. |
| `VIREMENT SALAIRE …` `2200,00` with no `+` | a missing sign | real BP credits carry no `+`. |
| `ACHAT CB PAYPAL  SAMPLE` | a normal card row | ~9.3% of real BP rows are PayPal charges with the merchant truncated to 6 chars — permanently uncategorizable from BP alone. The target of the deferred PayPal enrichment join. |
| header block of exactly 7 lines with odd trailing spaces | tidyable | `bp.py` hardcodes `skiprows=7`. The padding is verbatim; "tidying" it breaks nothing visibly and everything silently. |

### `sample_c24.csv`

| Row / field | Looks like | Actually proves |
|---|---|---|
| `"-37,99 €"` — currency symbol inside the amount | a formatting slip | the current C24 export really does this. It breaks `c24.py`'s `.str.replace(",", ".").astype(float)` with a `ValueError`. Older exports had no `€`, which is why the parser must strip it defensively. |
| a 95-character `Verwendungszweck` | filler text | 95 is the real maximum. Catches silent truncation. |
| duplicate `Sample Drugstore` pair | a copy-paste error | within-file duplicates, `dedupe_seq` 0 and 1 — the C24 equivalent of `BEER KING`. |
| empty `Verwendungszweck` | missing data | exercises the `rstrip("_")` in `c24.py:59`, which otherwise leaves a trailing underscore on `Name`. |
| `Sample Sparkonto Übertrag` | a normal payee | the UTF-8 canary (`Ü` = `C3 9C`). |
| identical `Kontoname` on every row | pointless repetition | 4c asserts one account per file and fails loudly on mismatch — the guard against importing the Food pocket under `--account girokonto`, which is otherwise silent and poisons Phase 6 totals permanently. |
| `Geldanlage / Kapitalanlage` row | an expense | must land as `type = 'transfer'`. Counting invested money as consumption makes the yearly total lie by whatever you saved. |
| BOM (`EF BB BF`) at byte 0 | nothing — it's invisible | it is genuinely the first *character* of the file, so the first header becomes `﻿Transaktionstyp` and `df["Transaktionstyp"]` raises `KeyError` with an error message that looks identical to what you typed. |

### `sample_tr.csv`

| Row / field | Looks like | Actually proves |
|---|---|---|
| `Sample Rail AG — Café Gare` | a needlessly fancy name | **the UTF-8 canary.** Without it the entire file is `us-ascii` and a wrong encoding assumption in the TR parser passes silently. |
| `description` ending in `null` | a bug in the fixture | a real Trade Republic exporter quirk — it concatenates the literal string `null`. The normalizer has to strip it. |
| `amount` = `-124.31` on the `BUY` row but `-15.100000` on card rows | inconsistent | TR really does vary the decimal width by row type. Never assume a fixed width. |
| literal UUIDs (`019ba7af-0000-4000-a000-…`) rather than `uuid4()` | lazy | a regenerated fixture must be **byte-identical**, or every run produces a git diff and the dedupe tests stop meaning anything. |
| `BUY` row with a non-zero `fee` | out of scope | the cash side imports as category `INVESTING` (`type = 'transfer'`). No portfolio tracking — the TR cash balance still reconciles and expense totals stay clean. |
| `mcc_code` `5411` / `4112` | noise | ISO 18245 merchant codes (grocery / rail). A free, standardized categorizer more reliable than any string rule — matched at `priority = 50`. |

## Overlap files

`*_overlap.*` exist to test one thing: **importing an overlapping export must not double-count.**

| | new rows | byte-identical rows | expected result on second import |
|---|---|---|---|
| `sample_bp_overlap.tsv` | 3 | 5 | `inserted_count = 3, skipped_count = 5` |
| `sample_c24_overlap.csv` | 3 | 4 | `inserted_count = 3, skipped_count = 4` |

The shared rows are not retyped — the generator slices them out of the base row list
(`BP_ROWS[:5]`), so they cannot drift when a row is edited. That is why both files come from one
script rather than one script per file.

That single assertion is the Definition of Done for the whole dedupe design.

## Not to be confused with

- **`backend/test/*`** — rows inserted straight into Postgres. Those test the **API**.
- **`data/sample/*`** (here) — fake export *files* fed to the Python ETL. These test the **parsers**.
- **`data/real/*`** — real banking data. Gitignored, never committed, never used in tests.
