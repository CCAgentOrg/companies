#!/usr/bin/env python3
"""Company Docs Pipeline — Data ingestion + Turso backend.

Ingests Hugo content frontmatter → SQLite/Turso DB → Hugo data/ JSON files.

For Turso remote: set TURSO_DB_URL and TURSO_AUTH_TOKEN env vars.
Leaving them unset uses local SQLite (turso/data.db).
"""

import os, sys, json, re, sqlite3
from pathlib import Path
from datetime import date

try:
    import yaml
except ImportError:
    sys.exit("pip install pyyaml")

# ── Paths ──
ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = ROOT / "content"
DATA_DIR = ROOT / "data" / "companies"
SCHEMA_FILE = ROOT / "turso" / "schema.sql"
DB_DIR = ROOT / "turso"
DB_FILE = DB_DIR / "data.db"

# ── Schema ──
SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS companies (
    slug TEXT PRIMARY KEY,
    ticker TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    sector TEXT,
    industry TEXT,
    founded INTEGER,
    employees INTEGER,
    market_cap TEXT,
    market_cap_cr REAL,
    current_price REAL,
    day_change REAL,
    stock_pe REAL,
    book_value REAL,
    dividend_yield REAL,
    roe REAL,
    roce REAL,
    face_value REAL,
    high_52wk REAL,
    low_52wk REAL,
    website TEXT,
    bse_code TEXT,
    nse_symbol TEXT,
    pulse INTEGER DEFAULT 50,
    pulse_label TEXT,
    isin TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS financials_yearly (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_slug TEXT REFERENCES companies(slug),
    year TEXT NOT NULL,
    sales_cr REAL,
    expenses_cr REAL,
    op_profit_cr REAL,
    opm_pct REAL,
    other_income_cr REAL,
    interest_cr REAL,
    depreciation_cr REAL,
    pat_cr REAL,
    eps REAL,
    UNIQUE(company_slug, year)
);

CREATE TABLE IF NOT EXISTS financials_quarterly (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_slug TEXT REFERENCES companies(slug),
    quarter TEXT NOT NULL,
    sales_cr REAL,
    expenses_cr REAL,
    op_profit_cr REAL,
    opm_pct REAL,
    other_income_cr REAL,
    interest_cr REAL,
    depreciation_cr REAL,
    pat_cr REAL,
    eps REAL,
    UNIQUE(company_slug, quarter)
);

CREATE TABLE IF NOT EXISTS shareholding (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_slug TEXT REFERENCES companies(slug),
    period TEXT NOT NULL,
    promoters_pct REAL,
    fiis_pct REAL,
    diis_pct REAL,
    govt_pct REAL,
    public_pct REAL,
    shareholders INTEGER,
    UNIQUE(company_slug, period)
);

CREATE TABLE IF NOT EXISTS segments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_slug TEXT REFERENCES companies(slug),
    segment TEXT NOT NULL,
    pct REAL,
    quarter TEXT,
    UNIQUE(company_slug, segment, quarter)
);

CREATE TABLE IF NOT EXISTS peers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_slug TEXT REFERENCES companies(slug),
    peer_slug TEXT,
    peer_name TEXT NOT NULL,
    ticker TEXT,
    market_cap_cr REAL,
    stock_pe REAL,
    roe REAL,
    revenue_growth REAL
);

CREATE TABLE IF NOT EXISTS milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_slug TEXT REFERENCES companies(slug),
    year TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_slug TEXT REFERENCES companies(slug),
    target_name TEXT NOT NULL,
    group_type TEXT NOT NULL
);
"""

# ── HELPERS ──

def parse_frontmatter(text: str) -> dict | None:
    """Extract YAML frontmatter from a Hugo markdown file."""
    m = re.match(r'^---\s*\n(.*?)\n---', text, re.DOTALL)
    if not m:
        return None
    try:
        return yaml.safe_load(m.group(1))
    except yaml.YAMLError:
        return None

def get_db() -> sqlite3.Connection:
    """Get a database connection — local SQLite by default, Turso if env vars set."""
    turso_url = os.environ.get("TURSO_DB_URL")
    turso_token = os.environ.get("TURSO_AUTH_TOKEN")
    
    if turso_url and turso_token:
        # Use Turso remote via libsql — requires `pip install libsql-client`
        try:
            from libsql_client import create_client
            # This returns an async client — we'll use a wrapper
            print("Using Turso remote database")
            return _get_turso_db(turso_url, turso_token)
        except ImportError:
            print("Warning: libsql-client not installed, falling back to local SQLite")
    
    # Local SQLite
    DB_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_FILE))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.row_factory = sqlite3.Row
    return conn

def init_db(conn: sqlite3.Connection):
    """Initialize schema."""
    conn.executescript(SCHEMA_SQL)
    conn.commit()
    print("✓ Schema initialised")

def clean_currency(val: str | None) -> float | None:
    """Convert '₹14,85,000 Cr' → 1485000.0 Cr value, or None."""
    if not val:
        return None
    val = str(val).replace('₹', '').replace(',', '').replace(' Cr', '').replace('L', '00000')
    # Handle L (lakh) notation — need smarter parsing
    # For now: strip all non-numeric except decimal
    clean = re.sub(r'[^0-9.]', '', val)
    try:
        return float(clean) if clean else None
    except ValueError:
        return None

def clean_pct(val) -> float | None:
    """Convert percentage string to float."""
    if val is None:
        return None
    s = str(val).replace('%', '').strip()
    try:
        return float(s)
    except ValueError:
        return None

# ── INGESTION ──

def ingest_content_file(path: Path, conn: sqlite3.Connection):
    """Parse one Hugo content file and insert into DB."""
    raw = path.read_text()
    fm = parse_frontmatter(raw)
    if not fm:
        print(f"  ✗ No frontmatter in {path.name}")
        return
    
    slug = path.stem
    print(f"\n  → {slug}: {fm.get('title', '?')}")
    
    # Companies table
    conn.execute("""
        INSERT OR REPLACE INTO companies
        (slug, ticker, name, description, sector, industry, founded, employees,
         market_cap, stock_pe, roe, pulse, pulse_label, isin)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (
        slug,
        fm.get('ticker', ''),
        fm.get('title', ''),
        fm.get('description', ''),
        fm.get('sector', ''),
        fm.get('industry', ''),
        fm.get('founded'),
        fm.get('employees'),
        fm.get('market_cap', ''),
        fm.get('stock_pe'),
        fm.get('roe'),
        fm.get('pulse', 50),
        fm.get('pulse_label', ''),
        fm.get('isin', ''),
    ))
    
    # Financials yearly
    if 'profit' in fm:
        for d in fm['profit']:
            # Try to find matching revenue
            rev = next((r for r in (fm.get('revenue') or []) if r.get('year') == d.get('year')), {})
            conn.execute("""
                INSERT OR REPLACE INTO financials_yearly
                (company_slug, year, sales_cr, pat_cr)
                VALUES (?,?,?,?)
            """, (slug, d.get('year'), rev.get('value'), d.get('value')))
    
    # Milestones
    if 'events' in fm:
        for e in fm['events']:
            conn.execute("""
                INSERT INTO milestones (company_slug, year, title, description)
                VALUES (?,?,?,?)
            """, (slug, e.get('year', ''), e.get('title', ''), e.get('description', '')))
    
    conn.commit()

def export_hugo_data(conn: sqlite3.Connection):
    """Export DB data to Hugo-compatible JSON in data/companies/."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    rows = conn.execute("SELECT * FROM companies").fetchall()
    for row in rows:
        slug = row['slug']
        company = dict(row)
        
        # Fetch child data
        company['financials_yearly'] = [
            dict(r) for r in conn.execute(
                "SELECT year, sales_cr, pat_cr FROM financials_yearly WHERE company_slug=? ORDER BY year",
                (slug,)
            ).fetchall()
        ]
        company['milestones'] = [
            dict(r) for r in conn.execute(
                "SELECT year, title, description FROM milestones WHERE company_slug=? ORDER BY year",
                (slug,)
            ).fetchall()
        ]
        company['segments'] = [
            dict(r) for r in conn.execute(
                "SELECT segment, pct, quarter FROM segments WHERE company_slug=?",
                (slug,)
            ).fetchall()
        ]
        company['connections'] = [
            dict(r) for r in conn.execute(
                "SELECT target_name, group_type FROM connections WHERE company_slug=?",
                (slug,)
            ).fetchall()
        ]
        company['shareholding'] = [
            dict(r) for r in conn.execute(
                "SELECT period, promoters_pct, fiis_pct, diis_pct, public_pct, shareholders FROM shareholding WHERE company_slug=? ORDER BY period",
                (slug,)
            ).fetchall()
        ]
        
        # Write JSON
        out_path = DATA_DIR / f"{slug}.json"
        out_path.write_text(json.dumps(company, indent=2, default=str))
        print(f"  ✓ Exported data/companies/{slug}.json")

def export_hugo_data_index(conn: sqlite3.Connection):
    """Export an index of all companies for the homepage."""
    rows = conn.execute("""
        SELECT slug, name, ticker, sector, market_cap, pulse, pulse_label
        FROM companies ORDER BY name
    """).fetchall()
    index = [dict(r) for r in rows]
    (DATA_DIR / "index.json").write_text(json.dumps(index, indent=2, default=str))
    print(f"✓ Exported data/companies/index.json ({len(index)} companies)")

# ── MAIN ──

def main():
    print("═" * 50)
    print("Company Docs Pipeline")
    print("═" * 50)
    
    conn = get_db()
    init_db(conn)
    
    # Ingest from Hugo content files
    content_files = list(CONTENT_DIR.glob("*.md")) if CONTENT_DIR.exists() else []
    if content_files:
        print(f"\n📥 Ingesting {len(content_files)} content files...")
        for f in sorted(content_files):
            ingest_content_file(f, conn)
    else:
        print("⚠ No content files found in content/ — data may be empty")
    
    # Export Hugo data files
    print(f"\n📤 Exporting Hugo data files...")
    export_hugo_data(conn)
    export_hugo_data_index(conn)
    
    print(f"\n✅ Pipeline complete")
    print(f"   DB: {DB_FILE}")
    print(f"   Data: {DATA_DIR}/")
    print(f"   Companies: {len(content_files)}")

if __name__ == "__main__":
    main()
