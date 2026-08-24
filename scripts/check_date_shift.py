#!/usr/bin/env python3
"""Detect pending-date-shift duplicates across overlapping bank exports.

The risk: a transaction appears in one export dated the day of export (a
pending placeholder), then in a later export with its real settlement date.
`date` is part of `dedupe_hash`, so the two rows hash differently and BOTH
insert — a silent double-count.

Run against real exports (gitignored, never committed):

    python3 scripts/check_date_shift.py data/real/bp/tsv/*.tsv
    python3 scripts/check_date_shift.py data/real/c24/*.csv

Result 2026-08-24: zero hits across 11 BP + 3 C24 exports (2023-2025) —
both banks export only booked transactions. Re-run in Phase 4e once two
OVERLAPPING 2026 exports exist; the historical set does not overlap the
2026-08-24 export, so current-day behaviour is still unverified.

See PLAN_unifin.md -> M4 -> "The pending-date problem".
"""

import collections
import csv
import itertools
import sys
from datetime import date, datetime
from pathlib import Path

WINDOW_DAYS = 10  # a settlement lag; wider than this is a recurring charge


def read_bp(path: Path) -> list[tuple[date, str, str]]:
    """BP .tsv — ISO-8859-1, CRLF, 7 header lines, tab-delimited."""
    out = []
    with open(path, encoding="ISO-8859-1", newline="") as f:
        for i, line in enumerate(f):
            if i < 7:
                continue
            parts = line.rstrip("\r\n").split("\t")
            if len(parts) < 3:
                continue
            out.append((datetime.strptime(parts[0], "%d/%m/%Y").date(),
                        parts[1].strip('"'), parts[2]))
    return out


def read_c24(path: Path) -> list[tuple[date, str, str]]:
    """C24 .csv — UTF-8 with BOM, LF, comma-delimited, 14 columns."""
    out = []
    with open(path, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            try:
                d = datetime.strptime(r.get("Buchungsdatum", ""), "%d.%m.%Y").date()
            except ValueError:
                continue
            out.append((d, r.get("Zahlungsempfänger") or "", r.get("Betrag") or ""))
    return out


def main(paths: list[Path]) -> int:
    if not paths:
        print(__doc__)
        return 2

    read = read_bp if paths[0].suffix.lower() == ".tsv" else read_c24
    print(f"{len(paths)} exports, ±{WINDOW_DAYS}d window\n")

    hits = set()
    for a, b in itertools.combinations(paths, 2):
        # Key deliberately EXCLUDES the date — that is the field under suspicion.
        da: dict = collections.defaultdict(list)
        db: dict = collections.defaultdict(list)
        for d, name, amt in read(a):
            da[(name, amt)].append(d)
        for d, name, amt in read(b):
            db[(name, amt)].append(d)

        for key in da.keys() & db.keys():
            sa, sb = sorted(da[key]), sorted(db[key])
            if sa == sb:
                continue
            for x in sa:
                for y in sb:
                    # `x not in sb` excludes rows present unchanged in both files.
                    if 0 < abs((x - y).days) <= WINDOW_DAYS and x not in sb and y not in sa:
                        hits.add((abs((x - y).days), key[0][:34], key[1], x, y))

    print(f"date-shifted candidates: {len(hits)}")
    for delta, name, amt, x, y in sorted(hits)[:20]:
        print(f"  +{delta}d  {name:<36} {amt:>12}   {x} -> {y}")
    if not hits:
        print("  (none — this bank exports only booked transactions)")
    return 1 if hits else 0


if __name__ == "__main__":
    sys.exit(main([Path(p) for p in sys.argv[1:]]))
