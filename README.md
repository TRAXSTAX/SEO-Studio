# 🚀 SEO Studio — Enterprise SEO Engineering Suite

**SEO Studio** is a full-featured, high-performance web platform containing 16 specialized technical SEO, content optimization, search analytics, and SERP simulation tools built with Node.js, Express, SQLite, Puppeteer, and a modern glassmorphism web interface.

---

## 🛠️ Included Tools (16-in-1 Suite)

### 📊 1. GSC Intelligence Hub
- Deep multi-file analysis for Google Search Console exports (`Queries.csv` and `Pages.csv`).
- Cross-references query performance with target URLs.
- Identifies **Quick Wins** (Position 11-20 queries with high impressions).
- Calculates CTR performance against expected CTR benchmarks.
- Detects rank decay and position distribution across top 3, top 10, and top 20 positions.

### 👁️ 2. SERP Snippet Previewer
- Real-time Google SERP rendering simulator with mobile/desktop device toggle.
- Precise HTML canvas pixel-width title truncation engine (matching Google's ~580px desktop / ~920px mobile thresholds).
- Live character & pixel counters for title and meta description tuning.

### ⚡ 3. Bulk HTTP Status Checker
- Concurrent multi-threaded URL status inspector (processes batch queues 8 URLs at a time).
- Uncovers response codes, full redirect chains, hop counts, and server response timing.
- Export audit results directly to CSV.

### 🌳 4. Heading Structure Analyzer
- Visual tree map of H1–H6 heading hierarchy for any web page.
- Automatic diagnostic check for missing H1 tags, multiple H1s, skipped heading levels, and empty heading text.

### 🌐 5. Deep Site Crawler
- Multi-page crawler supporting configurable depth, request concurrency, and max page limits.
- Evaluates title length, meta description quality, canonical tags, word count, HTTP status, internal link depth, and orphan page detection.

### 🎯 6. Search Intent Mapper
- Offline NLP/Rule-based keyword classification engine.
- Instant categorisation into **Informational**, **Transactional**, **Commercial**, and **Navigational** search intent.

### 📝 7. Content Grader & TF-IDF Analyzer
- Evaluates keyword density, readability scores (Flesch-Kincaid), and heading coverage.
- Suggests missing LSI (Latent Semantic Indexing) terms to improve content depth and relevance.

### 🔍 8. Master Technical SEO Auditor
- Instant single-page audit engine scoring Performance, SEO, Accessibility, and Security.
- Inspects status codes, OpenGraph tags, canonical tags, schema markups, and heading integrity.

### 🔗 9. Contextual Internal Link Finder
- Scans existing site content to identify exact sentence-level insertion opportunities for targeted target keywords.

### 📑 10. Server Log File Analyzer
- Parses raw Apache / Nginx server access logs.
- Isolates search engine bot hits (Googlebot, Bingbot), tracks crawl frequency, crawl budget distribution, and status code breakdown.

### 🏷️ 11. Meta Tag Optimizer
- AI-inspired meta title & description generator with SEO scoring based on length, sentiment, primary keyword placement, and call-to-action power.

### 🧩 12. Schema Markup Generator (JSON-LD)
- Visual generator supporting 13 schema types: `Article`, `Product`, `LocalBusiness`, `Organization`, `FAQPage`, `HowTo`, `BreadcrumbList`, `Event`, `JobPosting`, `Recipe`, `Person`, `VideoObject`, `SoftwareApplication`.

### 🏎️ 13. Web Vitals & Lighthouse Runner
- Direct integration with Google Lighthouse & Chrome Launcher.
- Measures Core Web Vitals: LCP (Largest Contentful Paint), CLS (Cumulative Layout Shift), TBT (Total Blocking Time), and FCP.

### ⚔️ 14. Keyword Cannibalization Checker
- Upload GSC data or paste URL/Keyword maps to automatically highlight keyword overlap and internal competition between URLs.

### 🔗 15. Broken Links & Redirect Inspector
- Extracts all on-page internal and external hyperlinks, validates HTTP response codes in parallel, and alerts on broken 404 links or redirect chains.

### 📜 16. SEO History & Trends
- SQLite-backed audit history database.
- Tracks page scores over time to measure SEO regression and improvements.

---

## 💻 Tech Stack

- **Backend**: Node.js (ES Modules), Express.js
- **Database**: SQLite3
- **Automation / Scraping**: Puppeteer, Chrome Launcher, Lighthouse, `node-html-parser`
- **Streaming**: Server-Sent Events (SSE) for real-time progress logging
- **Frontend**: Vanilla JS (ES6+), CSS Custom Properties, Glassmorphism UI Design System (No heavy JS framework required)

---

## ⚙️ Quick Start

### 1. Prerequisites
- Node.js **v18+** installed

### 2. Installation
```bash
# Clone repository
git clone https://github.com/TRAXSTAX/seo-studio.git
cd seo-studio

# Install dependencies
npm install
```

### 3. Start Application
```bash
npm start
```
The server will start at `http://localhost:3000`. Open your browser and access the interactive workspace.

---

## 📁 Repository Architecture

```
seo-studio/
├── lib/                        # Core backend module library
│   ├── bulk-status-checker.mjs # Multi-threaded HTTP status batch checker
│   ├── crawler.mjs             # Multi-page site crawler engine
│   ├── db.mjs                  # SQLite database interface & migrations
│   ├── gsc-analyzer.mjs        # GSC Multi-file CSV analytics engine
│   ├── heading-analyzer.mjs    # Heading hierarchy visualizer & validator
│   ├── intent-engine.mjs       # Offline NLP keyword intent classifier
│   ├── lighthouse-runner.mjs   # Chrome Lighthouse Web Vitals collector
│   └── ...                     # Additional tool engines
├── public/                     # Frontend client assets
│   ├── index.html              # Unified Single Page Application markup
│   ├── index.css               # Glassmorphism design system styles
│   └── app.js                  # Client-side routing, SSE listeners, tool logic
├── server.mjs                  # Express API server & SSE endpoints
├── package.json
└── README.md
```

---

## 📜 License

Distributed under the MIT License.
