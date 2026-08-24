#!/usr/bin/env python3
"""Generate the synthetic bank-export fixtures in data/sample/.

Run by hand whenever a format changes or a row is added:

    python3 scripts/make_fixtures.py

The generated files are what the tests read — this script is never in the
test path. Formats were verified against real exports on 2026-08-24; see
PLAN_unifin.md §4a.3 "Formats VERIFIED against real exports".
"""
import csv
from pathlib import Path

# scripts/make_fixtures.py -> scripts/ -> repo root. Resolving from __file__
# rather than cwd means the script works no matter where it is invoked from.
ROOT = Path(__file__).resolve().parent.parent
SAMPLE = ROOT / "data" / "sample"


# ── La Banque Postale ────────────────────────────────────────────────────
# Real format: ISO-8859-1, CRLF, tab-delimited, comma decimal separator.
# Header block is exactly 7 lines because bp.py hardcodes skiprows=7.
# The trailing spaces below are verbatim from a real export — do not tidy them.

CARD = "CARTE NUMERO                111  "  # 16 spaces before, 2 after — real


def bp_header(statement_date: str, solde: str) -> list[str]:
    return [
        "Numéro Compte\t0000000S000",
        "Type\tCCP",
        "Compte tenu en  \teuros",
        f"Date            \t{statement_date}",
        f"Solde (EUROS)   \t{solde}",
        "",
        "Date\tLibellé\tMontant(EUROS)",
    ]


# (date, libellé, amount) — amounts as strings so the bytes on disk have a
# single source of truth. Newest first, matching the real export order.

# Categories a, b, c, ... come from 'PLAN_unifin.md' at '###### Required rows — `sample_bp.tsv`'
BP_ROWS = [
    # a — padding, embedded transaction date, card number: every pattern
    #     normalize.py has to strip, in one row.
    ("15/03/2026", f"ACHAT CB SAMPLE MARKET 12.03.26 EUR    45,20 {CARD}", "-45,20"),

    # f — THE ISO-8859-1 CANARY. Decoded wrongly this renders "CAFÃ‰ DES ARTS".
    #     Also the reason `file` reports ISO-8859 at all: pure ASCII would be
    #     valid UTF-8 and the check would prove nothing.
    ("14/03/2026", f"ACHAT CB CAFÉ DES ARTS 13.03.26 {CARD}", "-8,50"),

    # g — PayPal-funded card charge (~9.3% of real BP rows). Not enriched in
    #     v1; this row is what Phase 4e's enrichment join will target.
    ("13/03/2026", f"ACHAT CB PAYPAL  SAMPLE 01.03.26 {CARD}", "-24,90"),

    # d — income. No "+" prefix: real credits are bare, e.g. "350,00".
    ("12/03/2026", "VIREMENT SALAIRE SAMPLE EMPLOYER SA", "2200,00"),

    # e — outbound transfer; Phase 6 pairs it with its counterpart.
    ("11/03/2026", "VIREMENT INSTANTANE A SAMPLE PERSON", "-150,00"),

    # c — same date AND same amount, different libellé. Proves the hash reads
    #     the name: both rows must insert, each with dedupe_seq = 0.
    ("10/03/2026", f"ACHAT CB SAMPLE BAKERY 09.03.26 {CARD}", "-13,00"),
    ("10/03/2026", f"ACHAT CB SAMPLE KIOSK 09.03.26 {CARD}", "-13,00"),

    # b — THREE BYTE-IDENTICAL ROWS. Not a copy-paste error. Models the real
    #     "3 x BEER KING on one night": dedupe_seq must come out 0, 1, 2.
    #     Delete these and the entire dedupe design goes untested.
    ("09/03/2026", f"ACHAT CB BEER KING SAMPLE 08.03.26 {CARD}", "-13,00"),
    ("09/03/2026", f"ACHAT CB BEER KING SAMPLE 08.03.26 {CARD}", "-13,00"),
    ("09/03/2026", f"ACHAT CB BEER KING SAMPLE 08.03.26 {CARD}", "-13,00"),
]

# Rows dated AFTER sample_bp.tsv's newest. The overlap file is these three
# plus the newest five of BP_ROWS, byte-identical — so importing it second
# must yield inserted_count = 3, skipped_count = 5.
BP_OVERLAP_NEW = [
    ("18/03/2026", f"ACHAT CB SAMPLE MARKET 17.03.26 {CARD}", "-31,40"),
    ("17/03/2026", f"ACHAT CB CAFÉ DES ARTS 16.03.26 {CARD}", "-4,20"),
    ("16/03/2026", "PRLV SEPA SAMPLE TELECOM SA", "-19,99"),
]


def write_bp(path: Path, statement_date: str, solde: str, rows) -> None:
    """Write one BP-format .tsv.

    Body row layout is `date \\t "libellé" \\t amount` — only the libellé is
    quoted, so we format by hand rather than using csv.writer (which would
    apply its own quoting rules and not reproduce this exactly).
    """
    lines = bp_header(statement_date, solde)
    lines += [f'{date}\t"{libelle}"\t{amount}' for date, libelle, amount in rows]

    # encoding= : how str becomes bytes. "é" -> the single byte E9.
    # newline=  : what every "\n" we write is translated into on the way out.
    #             Writing "\r\n" ourselves here would produce "\r\r\n".
    with open(path, "w", encoding="ISO-8859-1", newline="\r\n") as f:
        f.write("\n".join(lines) + "\n")  # real exports end with a terminator

# ── C24 Bank ─────────────────────────────────────────────────────────────
# Real format (verified 2026-08-24 against data/real/temp/20260824/):
# UTF-8 WITH BOM, LF (not CRLF), comma-delimited, comma decimal,
# 14 columns, Betrag carries " €".
#
# Older exports used 10- and 11-column schemas without the € suffix. v1
# imports only the current export, so only this vintage is generated —
# but the parser must still read BY COLUMN NAME, never position.

C24_COLS = [
    "Transaktionstyp", "Buchungsdatum", "Karteneinsatz", "Betrag",
    "Zahlungsempfänger", "IBAN", "BIC", "Verwendungszweck", "Beschreibung",
    "Kontonummer", "Kontoname", "Kategorie", "Unterkategorie",
    "Bargeldabhebung",
]

# Exactly 95 chars — the real maximum, catches silent truncation.
LONG_ZWECK = ("SAMPLE REFERENZ MAXIMALE LAENGE " * 3)[:95]

# Every row shares one Kontoname: 4c asserts one account per file and
# fails loudly on mismatch (guards against a wrong --account flag).
KONTO = {"Kontonummer": "0000000000", "Kontoname": "C24 Smartkonto"}

C24_ROWS = [
    # empty Verwendungszweck — exercises the rstrip("_") in c24.py:59
    {"Transaktionstyp": "Kartenzahlung", "Buchungsdatum": "04.03.2026",
     "Karteneinsatz": "03.03.2026 19:42", "Betrag": "-37,99",
     "Zahlungsempfänger": "Sample Supermarket", "Verwendungszweck": "",
     "Beschreibung": "SAMPLE SUPERMARKET",
     "Kategorie": "Lebensmittel", "Unterkategorie": "Supermarkt", **KONTO},

    # 95-char Verwendungszweck
    {"Transaktionstyp": "SEPA-Überweisung", "Buchungsdatum": "04.03.2026",
     "Karteneinsatz": "", "Betrag": "-120,00",
     "Zahlungsempfänger": "Sample Landlord", "Verwendungszweck": LONG_ZWECK,
     "Beschreibung": "", "Kategorie": "Wohnen & Haushalt",
     "Unterkategorie": "Miete", **KONTO},

    # within-file duplicate pair — both must insert, dedupe_seq 0 and 1
    {"Transaktionstyp": "Kartenzahlung", "Buchungsdatum": "03.03.2026",
     "Karteneinsatz": "03.03.2026 12:05", "Betrag": "-8,95",
     "Zahlungsempfänger": "Sample Drugstore", "Verwendungszweck": "",
     "Beschreibung": "SAMPLE DROGERIE", "Kategorie": "Shopping",
     "Unterkategorie": "Drogerie", **KONTO},
    {"Transaktionstyp": "Kartenzahlung", "Buchungsdatum": "03.03.2026",
     "Karteneinsatz": "03.03.2026 12:05", "Betrag": "-8,95",
     "Zahlungsempfänger": "Sample Drugstore", "Verwendungszweck": "",
     "Beschreibung": "SAMPLE DROGERIE", "Kategorie": "Shopping",
     "Unterkategorie": "Drogerie", **KONTO},

    # income — bank-supplied category, the priority-90 fallback
    {"Transaktionstyp": "SEPA-Überweisung", "Buchungsdatum": "02.03.2026",
     "Karteneinsatz": "", "Betrag": "2200,00",
     "Zahlungsempfänger": "Sample Employer SA",
     "Verwendungszweck": "GEHALT 03/2026", "Beschreibung": "",
     "Kategorie": "Einkommen", "Unterkategorie": "Lohn/ Gehalt", **KONTO},

    # investment — must land as type = 'transfer', never expense
    {"Transaktionstyp": "SEPA-Überweisung", "Buchungsdatum": "02.03.2026",
     "Karteneinsatz": "", "Betrag": "-500,00",
     "Zahlungsempfänger": "Sample Broker", "Verwendungszweck": "SPARPLAN",
     "Beschreibung": "", "Kategorie": "Geldanlage",
     "Unterkategorie": "Kapitalanlage", **KONTO},

    # cash withdrawal — note the trailing Bargeldabhebung column
    {"Transaktionstyp": "Bargeldabhebung", "Buchungsdatum": "01.03.2026",
     "Karteneinsatz": "01.03.2026 08:11", "Betrag": "-20,00",
     "Zahlungsempfänger": "Sample ATM", "Verwendungszweck": "",
     "Beschreibung": "", "Kategorie": "Bargeld",
     "Unterkategorie": "Bargeld", "Bargeldabhebung": "Ja", **KONTO},

    # pocket transfer — the accented payee doubles as the UTF-8 canary
    {"Transaktionstyp": "Pocket-Umbuchung", "Buchungsdatum": "01.03.2026",
     "Karteneinsatz": "", "Betrag": "-150,00",
     "Zahlungsempfänger": "Sample Sparkonto Übertrag",
     "Verwendungszweck": "", "Beschreibung": "",
     "Kategorie": "Umbuchung", "Unterkategorie": "Umbuchung", **KONTO},
]

# 3 new rows dated later + the newest 4 of C24_ROWS, byte-identical.
C24_OVERLAP_NEW = [
    {"Transaktionstyp": "Kartenzahlung", "Buchungsdatum": "07.03.2026",
     "Karteneinsatz": "06.03.2026 20:15", "Betrag": "-12,40",
     "Zahlungsempfänger": "Sample Bäckerei", "Verwendungszweck": "",
     "Beschreibung": "SAMPLE BAECKEREI", "Kategorie": "Lebensmittel",
     "Unterkategorie": "Bäckerei", **KONTO},
    {"Transaktionstyp": "Online-Kartenzahlung", "Buchungsdatum": "06.03.2026",
     "Karteneinsatz": "06.03.2026 11:02", "Betrag": "-9,99",
     "Zahlungsempfänger": "Sample Streaming", "Verwendungszweck": "",
     "Beschreibung": "SAMPLE STREAMING",
     "Kategorie": "Freizeit & Unterhaltung",
     "Unterkategorie": "Digitale Produkte & Dienste", **KONTO},
    {"Transaktionstyp": "Zinszahlung", "Buchungsdatum": "05.03.2026",
     "Karteneinsatz": "", "Betrag": "1,87",
     "Zahlungsempfänger": "C24 Bank", "Verwendungszweck": "ZINSEN 02/2026",
     "Beschreibung": "", "Kategorie": "Einkommen",
     "Unterkategorie": "Kapitalerträge", **KONTO},
]


def write_c24(path: Path, rows: list[dict]) -> None:
    """Write one C24-format .csv.

    Unlike BP, csv.writer reproduces this exactly: QUOTE_MINIMAL quotes only
    fields containing the delimiter — which is precisely why the real file
    quotes Betrag ("-37,99 €") and nothing else.
    """
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        #   encoding="utf-8-sig" writes the BOM (EF BB BF)
        #   newline=""           lets csv control line endings, no translation
        #   lineterminator="\n"  LF — C24 is NOT CRLF
        w = csv.writer(f, lineterminator="\n")
        w.writerow(C24_COLS)
        for row in rows:
            out = dict(row)
            out["Betrag"] = f"{out['Betrag']} €"   # current vintage only
            w.writerow([out.get(c, "") for c in C24_COLS])


# ── Trade Republic ───────────────────────────────────────────────────────
# Real format: UTF-8 no BOM, LF, comma-delimited, EVERY field quoted,
# ISO dates, "." decimal, 23 columns. transaction_id is a stable UUID, so
# TR needs no dedupe_hash at all — see PLAN §4d.

TR_COLS = [
    "datetime", "date", "account_type", "category", "type", "asset_class",
    "name", "symbol", "shares", "price", "amount", "fee", "tax", "currency",
    "original_amount", "original_currency", "fx_rate", "description",
    "transaction_id", "counterparty_name", "counterparty_iban",
    "payment_reference", "mcc_code",
]

# UUIDs are LITERAL, never uuid4(): a regenerated fixture must be
# byte-identical, or every run produces a git diff and the dedupe test
# stops meaning anything.
TR_ROWS = [
    {"datetime": "2026-03-02T09:15:22.101010Z", "date": "2026-03-02",
     "account_type": "DEFAULT", "category": "CASH",
     "type": "TRANSFER_INSTANT_INBOUND", "amount": "300.000000",
     "currency": "EUR", "description": "Incoming transfer from Sample Person",
     "transaction_id": "019ba7af-0000-4000-a000-000000000001"},

    # mcc 5411 = grocery; the MCC rule (priority 50) must categorize this.
    # description ends in a literal "null" — a real TR exporter quirk the
    # normalizer has to strip.
    {"datetime": "2026-03-01T18:04:11.523000Z", "date": "2026-03-01",
     "account_type": "DEFAULT", "category": "CASH", "type": "CARD_TRANSACTION",
     "name": "Sample Supermarket GmbH", "amount": "-24.310000",
     "currency": "EUR", "description": "Sample Supermarket GmbHnull",
     "transaction_id": "019ba7af-0000-4000-a000-000000000002",
     "mcc_code": "5411"},

    # mcc 4112 = rail.
    # THE UTF-8 CANARY: the "é" here is the only non-ASCII byte in the file.
    # Without it the fixture is pure us-ascii, and a wrong encoding assumption
    # in the TR parser would pass silently — the same hole the old BP sample had.
    {"datetime": "2026-02-28T07:41:03.900000Z", "date": "2026-02-28",
     "account_type": "DEFAULT", "category": "CASH", "type": "CARD_TRANSACTION",
     "name": "Sample Rail AG — Café Gare", "amount": "-15.100000",
     "currency": "EUR", "description": "Sample Rail AG — Café Garenull",
     "transaction_id": "019ba7af-0000-4000-a000-000000000003",
     "mcc_code": "4112"},

    # BUY: cash side only, category INVESTING (type = 'transfer').
    # amount is 2dp here while card rows are 6dp — never assume the width.
    {"datetime": "2026-02-27T10:55:40.392Z", "date": "2026-02-27",
     "account_type": "DEFAULT", "category": "TRADING", "type": "BUY",
     "asset_class": "FUND", "name": "Sample World Index (Acc)",
     "symbol": "IE00SAMPLE001", "shares": "3.0000000000",
     "price": "41.4350000000", "amount": "-124.31", "fee": "-1.00",
     "currency": "EUR",
     "description": "Buy trade IE00SAMPLE001 Sample World Index, quantity: 3",
     "transaction_id": "019ba7af-0000-4000-a000-000000000004"},

    {"datetime": "2026-02-26T14:00:00.000000Z", "date": "2026-02-26",
     "account_type": "DEFAULT", "category": "CASH",
     "type": "TRANSFER_INSTANT_OUTBOUND", "amount": "-80.000000",
     "currency": "EUR", "description": "Outgoing transfer to Sample Person",
     "transaction_id": "019ba7af-0000-4000-a000-000000000005"},

    {"datetime": "2026-02-25T00:00:00.000000Z", "date": "2026-02-25",
     "account_type": "DEFAULT", "category": "CASH", "type": "EARNINGS",
     "amount": "1.240000", "currency": "EUR", "description": "Interest payout",
     "transaction_id": "019ba7af-0000-4000-a000-000000000006"},
]


def write_tr(path: Path) -> None:
    """Write the TR .csv — QUOTE_ALL, since TR quotes even empty fields."""
    with open(path, "w", encoding="utf-8", newline="") as f:   # no BOM
        w = csv.writer(f, quoting=csv.QUOTE_ALL, lineterminator="\n")
        w.writerow(TR_COLS)
        for row in TR_ROWS:
            w.writerow([row.get(c, "") for c in TR_COLS])


if __name__ == "__main__":
    SAMPLE.mkdir(parents=True, exist_ok=True)

# ── LBP  ───────────────────────────────────────────────────────
    write_bp(SAMPLE / "sample_bp.tsv", "15/03/2026", "1234,56", BP_ROWS)
    write_bp(
        SAMPLE / "sample_bp_overlap.tsv",
        "18/03/2026",
        "1178,97",
        BP_OVERLAP_NEW + BP_ROWS[:5],  # 3 new + 5 byte-identical
    )

    print(f"wrote {SAMPLE}/sample_bp.tsv ({len(BP_ROWS)} rows)")
    print(f"wrote {SAMPLE}/sample_bp_overlap.tsv "
          f"({len(BP_OVERLAP_NEW)} new + {len(BP_ROWS[:5])} overlapping)")

# ── C24 Bank  ───────────────────────────────────────────────────────

    write_c24(SAMPLE / "sample_c24.csv", C24_ROWS)
    write_c24(SAMPLE / "sample_c24_overlap.csv", C24_OVERLAP_NEW + C24_ROWS[:4])
    write_tr(SAMPLE / "sample_tr.csv")

    print(f"wrote {SAMPLE}/sample_c24.csv ({len(C24_ROWS)} rows)")
    print(f"wrote {SAMPLE}/sample_c24_overlap.csv "
          f"({len(C24_OVERLAP_NEW)} new + 4 overlapping)")
    print(f"wrote {SAMPLE}/sample_tr.csv ({len(TR_ROWS)} rows)")

# ── Trade Republic ───────────────────────────────────────────────────────


# write_bp()                        → data/sample/sample_bp.tsv
# ├─ write_bp_overlap()                → reuses BP_ROWS[:5] + 3 new rows
# ├─ C24_HEADER, C24_ROWS
# ├─ write_c24()                       → UTF-8-sig, LF, 14 cols
# ├─ TR_HEADER, TR_ROWS
# ├─ write_tr()                        → all fields quoted
# └─ if __name__ == "__main__":        calls them all
