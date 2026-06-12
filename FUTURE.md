# FUTURE — Company Docs Roadmap

## Gap Analysis vs Existing Platforms

### 🔴 High Priority — Needed for V1 Parity

| Feature | Screener | Moneycontrol | Yahoo Finance | Our Status |
|---------|----------|-------------|--------------|------------|
| **Live price + day change** | ✅ | ✅ | ✅ | ❌ |
| **P/E, P/B, Dividend Yield** | ✅ | ✅ | ✅ | ❌ |
| **Quarterly P&L table** | ✅ | ✅ | ✅ | ❌ |
| **Yearly financials** | ✅ | ✅ | ✅ | ❌ |
| **Shareholding trend** | ✅ | ✅ | ✅ | ❌ |
| **Peer comparison** | ✅ | ✅ | ✅ | ❌ |
| **Segment revenue breakup** | ✅ | ✅ | ✅ | ❌ |
| **Balance sheet highlights** | ✅ | ✅ | ✅ | ❌ |
| **EPS / diluted EPS** | ✅ | ✅ | ✅ | ❌ |
| **Index membership** | ✅ | ✅ | ✅ | ❌ |
| **Analyst ratings / price targets** | ✅ | ✅ | ✅ | ❌ |

### ⭐ Our Unique Advantages

| Feature | Why It Matters |
|---------|----------------|
| **Multi-perspective (Bull/Bear/Neutral/Data)** | No platform does opinionated framing |
| **Scrollytelling narrative** | Turns dry data into a story |
| **Connection force graph** | Entity relationship visualization |
| **Dark-theme first design** | Modern, distinct from utilitarian UI |
| **No ads, no data selling** | Privacy-first positioning |
| **Opinionated analysis with sourcing** | Grokipedia-style — this IS the moat |

## Implementation Phases

### Phase 1 — Data Density (NOW)
- [ ] Live price badge — NSE API in pulse bar
- [ ] Key valuation metrics — P/E, P/B, Div Yield, Market Cap
- [ ] Quarterly P&L table — sortable, 13 quarters
- [ ] Shareholding trend chart — FII/DII/Promoter over 12 quarters
- [ ] Segment revenue breakup donut
- [ ] Peer comparison mini section — top 5 peers
- [ ] Balance sheet highlights — cash, debt, equity, ROCE
- [ ] Index badges — Sensex, Nifty, etc.

### Phase 2 — Data Freshness
- [ ] Automated DuckDB pipeline → Hugo frontmatter
- [ ] CI rebuild on schedule
- [ ] Recent announcements feed from BSE

### Phase 3 — Distribution & SEO
- [ ] XML Sitemap
- [ ] Schema.org/Corporation structured data
- [ ] OpenGraph + Twitter Cards

### Phase 4 — Scale
- [ ] Client-side search (fuse.js)
- [ ] Auto-generated index by sector / market cap
- [ ] Graph connections auto-generated
- [ ] Compare mode — side-by-side
