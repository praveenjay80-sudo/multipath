# Canon — Scholarly Reading List Generator

## Project Location
`C:\Users\prave\Projects\canon`
Dev server: `npm run dev -- --port 4000` → http://localhost:4000
  - `vite.config.js` proxies `/api` → `http://localhost:3000` for local testing of Express routes — also run `node server.js` alongside `npm run dev` (defaults to port 3000; `PORT=xxxx node server.js` + matching proxy edit if 3000 is taken) when working on anything under `/api/*` (Top Scientists, html-proxy, UDC, GND, etc.). Without the Express process running, those routes 404 in dev even though the rest of the app works fine.
Deployed: https://canon-production-75f6.up.railway.app
GitHub: https://github.com/praveenjay80-sudo/canon
Deploy command: `railway up`

## Stack
- React 19 + Vite 8 + Tailwind CSS v3
- No backend — direct Anthropic API calls from browser (`anthropic-dangerous-direct-browser-access: true`)
- Streaming via SSE (fetch + ReadableStream)
- API key: `import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || ''`

## API Keys (Settings panel, `ApiKeyInput.jsx`)
- `canon_api_key` — Anthropic, required for every Claude-touching mode
- `canon_serp_key` — SerpAPI, optional, used by `useCanonValidator.js` and Top Scientists' Most Cited Publications fallback (routed through the Cloudflare Worker, see below — never called directly, no CORS headers)
- `canon_openalex_key` — OpenAlex, optional but effectively necessary as of 2026: **OpenAlex switched to credit-based rate limiting in 2026** — keyless/mailto-only requests now 429 almost immediately (confirmed live: `Retry-After` ~20h, `$0` prepaid credit remaining). A free key (openalex.org/settings/api) restores the real `$1/day` quota. Threaded through every OpenAlex call site (9 files) via the shared `src/utils/openAlexAuth.js` → `openAlexAuth()`, which appends `&api_key=...` when the key is set. This affects far more than any single mode — the sidebar's field/topic taxonomy, Concept Search, Canon Drift, Enrichment, Top Scientists' publications lookup, and the Canon Validator all call OpenAlex directly and will throttle without it.

## Express Server Proxy Routes (`server.js`)
- `GET /api/lcsh/:id` — proxies id.loc.gov (LCSH subject data)
- `GET /api/usp/mac` + `/api/usp/arv` — proxies vocabusp.abcd.usp.br (USP vocabulary)
- `GET /api/gnd/search` + `/api/gnd/:id` — proxies lobid.org (GND linked data)
- `GET /api/sparql` — proxies query.wikidata.org (Wikidata SPARQL)
- `GET /api/udc-new-terms` — proxies eth-udk.library.ethz.ch (UDC new terms, used by UDC mode)
- `GET /api/html-proxy?url=` — generic HTML proxy for scan-for-updates features. Fetches any `https://` URL server-side (no CORS restrictions). Used by: OntologicalAtlas scan (ontologicalatlas.com), Academia scan (academia.edu). Both formerly used direct browser fetches (CORS-blocked) or corsproxy.io (unreliable third party).
- `GET /api/topsci/query` + `GET /api/topsci/detail` + `GET /api/topsci/check-updates` — proxy pasanhu.cn's `HSSrv.asmx` ASMX JSON service (Top Scientists mode, see below). Needs a bearer token embedded in pasanhu.cn's own page HTML (`main.render("<token>", ...)`, regenerated per page load but not login-gated) — fetched server-side by `getPasanhuToken()`, cached 5 min, force-refreshed on a 401. **Upstream page-size limit is undocumented and scales with column count, not row count** — a 13-column query 500s above ~300-400 rows/page even though a 1-column query handles 1000 fine (confirmed live 2026-07-14); `PASANHU_UPSTREAM_PAGE = 250` in `server.js` and `PAGE_SIZE = 500` in `scripts/crawl-topsci-facets.mjs` both stay safely under this. The service exposes no sort parameter — `/api/topsci/query` passes through pasanhu.cn's native order (already rank/composite-score sorted) for the default sort, but for any other `sortBy` it fetches the full filtered set (capped at `PASANHU_FETCH_ALL_CAP = 30000` rows, batched at `PASANHU_FETCH_CONCURRENCY = 8`) and sorts locally, cached in-memory 10 min keyed by the filter+sort combo (`pasanhuQueryCache`).

## Cloudflare Worker (`worker/`)
Separate deploy target from the Railway app — `worker/src/index.js`, deployed via `wrangler deploy` from the `worker/` directory (requires `wrangler login` first; not deployable from this environment, no stored Cloudflare credentials). Live at `https://canon-enrichment.canonworks.workers.dev`. Holds `SERPAPI_KEY` as a Worker secret (`wrangler secret put SERPAPI_KEY`) plus a KV cache binding (`CACHE`).
- **Why it exists at all**: Google Scholar has no public API. SerpAPI (the paid proxy for it) sends no `Access-Control-Allow-Origin` header — confirmed via direct curl, not a browser quirk — so a browser calling `serpapi.com` directly always fails, and exposing a paid key client-side would be wrong even if it didn't. Every Scholar-touching feature must route through this worker instead of `serpapi.com`.
- `GET /enrich?title=&author=` — single-work lookup (title/author → best citation match by highest-cited title-overlap), used by `useEnrichment.js`/`useCanonValidator.js`-style verification. 7-day KV cache.
- `GET /scholar-search?q=&num=` — broad topic search, used by Top Scientists' Most Cited Publications fallback (see mode 20). Optional `key=` query param lets a caller pass their own SerpAPI key through, which takes priority over the worker's shared `SERPAPI_KEY` secret server-side (so a BYOK user isn't limited by the shared key's quota). Only results fetched with the shared key are cached (24h KV) — a passed-through user key's results are never cached, to avoid leaking one user's results to another under the same query-only cache key.
- **Known issue**: the shared `SERPAPI_KEY` was observed returning `429` (quota/rate-limited) from the worker itself on 2026-07-08 — independent of the CORS fix. `useCanonValidator.js`'s empty-result fallback and Top Scientists' `ScholarKeyPrompt` both degrade gracefully when this happens, prompting for the user's own key when the shared one is failing.

## Models
- Canon generation + Prerequisites + Curriculum: `claude-sonnet-5`
- Reading order + Work explainer + Taxonomy: `claude-haiku-4-5-20251001`

## App Modes (tabs in header)
1. **Generate Canon** (`appMode === 'canon'`) — full 5-section or subfield 3-section reading lists
2. **Pre & Post Requisites** (`appMode === 'reverse'`) — complete prerequisite + postrequisite map for any paper/book
3. **Curriculum** (`appMode === 'curriculum'`) — university-style curriculum grounded in Open Syllabus Project data
4. **Dissertation** (`appMode === 'dissertation'`) — 5-tier qualifying exam reading list for any PhD research question
5. **Canon Drift** (`appMode === 'drift'`) — how a field's canon shifted across 4 eras with DEFINING/RISING/FADING/WATCH tags
6. **Consilience** (`appMode === 'consilience'`) — cross-disciplinary synthesis: each field's lens, answer, convergences, tensions
7. **The Inquiry** (`appMode === 'inquiry'`) — open frontier questions: formulated, why hard, what's been tried, entry point
8. **Spectrum** (`appMode === 'spectrum'`) — real-life questions whose complete answer genuinely spans multiple disciplines (generated from a topic, tagged with discipline + tier, or typed directly); two-stage pipeline: (1) sonnet-5 generates 6 candidate questions with a "why it spans" justification, (2) picking/typing one triggers OSP + Semantic Scholar harvest + sonnet-5 concept breakdown (plain language, comprehensive, uncapped) + staged reading list (uncapped, covers every discipline's perspective, reuses `ReadingOrderView` unmodified) + a 4-6 paragraph synthesized ANSWER that explicitly names concepts and cites works by title
10. **Field Intelligence** (`appMode === 'intelligence'`) — 3-tab deep analysis: Landscape (all schools of thought), Audit (hidden assumptions + paradigm), Bibliography (exhaustive annotated bibliography with reading order + click-to-expand synopsis)
11. **Math Universe** (`appMode === 'math'`) — browse 15 math domains → subfields → topic chips → ordered reading sequence + beginner explanations
12. **Concept Map** (`appMode === 'concepts'`) — 4-tier static hierarchy of 2,575 concepts across 170 groups covering all of human knowledge (science, mathematics, medicine, law, humanities, business); loaded instantly from `public/data/concept-map.json` (no API calls for hierarchy); two-column layout: chips left, sticky 348px side panel right; side panel shows reading path OR explanation with PATH/EXPLAIN tabs when both are active
14. **UDC** (`appMode === 'udc'`) — Universal Decimal Classification browser, sourced from ETH-UDK (eth-udk.library.ethz.ch). Loads two datasets: `public/data/udc-full.json` (9,237 hierarchical nodes, 9 main classes) for the browse tree, and `public/data/udc-codes.json` (63,391 flat entries, 7 MB) for search + augmentation. **Browse tree augmentation (added 2026-07-10):** at load time, each flat code is assigned to its closest known ancestor via descending-prefix search (sorted ascending by code length so parents are processed first); this adds 37,427 previously-hidden codes as children throughout the tree (e.g. "113" now expands to show "113,1"–"113,9"). ~16k flat codes with no hierarchy ancestor remain search-only. Total unique codes: 63,426 (63,391 flat + 45 hierarchy-only). UDC code "12 Nature. Matter. Cosmos" has zero entries in ETH-UDK — confirmed live: index jumps from "113,9" to "13" with nothing between; not a scraping gap. Global mode selector (10 modes: Reading Path / Canon / Curriculum / Dissertation / Canon Drift / Consilience / Inquiry / Prerequisites / Spectrum / Field Intel) — clicking any node generates in the selected mode. Reading Path is handled inline (no tab switch), all other modes switch tab and trigger generation via `handleDoctoralTopicClick`. "Check for New Codes" button hits `/api/udc-new-terms` (server-side proxy, no CORS issues) which fetches `eth-udk.library.ethz.ch/new-terms/eng`, parses label+code+date, returns JSON; new entries are diffed against localStorage (`udc_new_codes`) and saved as patches; shown in a "New Codes" section grouped by date. Search covers both the static hierarchy and flat data simultaneously; context-aware (shows "in Parent" breadcrumb). WorldCat link per node.
15. **Academia** (`appMode === 'academia'`) — Academia.edu topic hierarchy browser. 3-level tree: 25 disciplines → 661 subtopics → 249,249 sub-subtopics = **249,917 total unique topics**. Static data code-split via dynamic `import()` (~18 MB raw / 4.9 MB gzip, only loads on demand). Crawled by `scripts/crawl-academia-topics.mjs` using `execFile('curl', [...])` with browser UA (Node https.get returns 403 from academia.edu). **Visible-items counter**: accordion expansion state lifted to parent (`expandedDiscs` Set + `expandedL2s` Set in `AcademiaTopicsView`); counter updates live as rows expand/collapse — 25 at top level, increments by L2 and L3 counts as rows open. L3 rows capped at 100 per L2 with "show more". Search across all 249,917 names capped at 200 results. "Scan for new topics" fetches via `/api/html-proxy`. Script diffs against existing file on re-run and reports new/removed topics. Each topic links to `academia.edu/Documents/in/{slug}` + 9-mode picker (same as other browse views).
16. **OVERALL AGGREGATOR** (`appMode === 'overall'`) — One question or topic → single shared harvest (syllabusHarvest + seminalPapersHarvest) → 9 Claude streams fire in parallel, sections render live as they stream. Natural story flow: (1) WHAT IS THIS — 3-paragraph orientation (Haiku, no harvest data); (2) HOW IT DEVELOPED — 4-era arc DEFINING/RISING/FADING/WATCH (Sonnet); (3) THE INTELLECTUAL LANDSCAPE — all schools, central exchanges, contested claim (Sonnet, up to 8000 tokens); (4) HIDDEN ASSUMPTIONS — founding assumptions, hidden axioms, paradigm audit (Sonnet); (5) EVERY DISCIPLINE'S ANSWER — consilience across all fields + synthesis (Sonnet); (6) THE ESSENTIAL WORKS — staged reading list + reading order (Sonnet); (7) WHAT YOU NEED FIRST — 4-phase prerequisite path (Haiku, no harvest data); (8) THE OPEN FRONTIER — open questions, why hard, who's working (Sonnet); (9) THE PATH TO MASTERY — university curriculum + PhD qualifying list (Sonnet). Output format: all sections produce markdown (###, **, -, prose) rendered by `StreamingText` component (no parsing). Colored nav pills (stone/amber/teal/rose/cyan/blue/violet/indigo/emerald) jump to sections. Copy All exports the full document. Key files: `src/hooks/useOverallAggregator.js` (exports `SECTION_DEFS`), `src/components/OverallAggregatorInput.jsx`, `src/components/OverallAggregatorView.jsx`.
18. **ONTOLOGICAL ATLAS** (`appMode === 'ontologicalatlas'`) — Browse ontologicalatlas.com: 208 schools of thought, 1,888 classified works, 453 thinker personas, 57 ethical dilemmas. Six ontological dimensions: ⧖ Time · ✦ Space · ◉ Matter · ◎ Observer · ⚡ Energy · ⧉ Information. Section tabs: Schools / Works / Personas / Dilemmas with live counts. Dimension filter bar filters schools by dimension. Universal search. SchoolCard: number, name, agency, thinkers, dimension indicators → expand for worldview + 6-dim tabs + moral/practical implications + mode picker. WorkCard: title, author/date, form/tradition, tagline, influence pills → expand + mode picker. PersonaCard: name, dates, description → expand + mode picker. DilemmaCard: title, description → expand + mode picker. Works pagination 60/page. "Scan for new info" fetches live counts via `/api/html-proxy`. External link to ontologicalatlas.com everywhere. Data: `src/constants/ontologicalAtlas.js` (~1.48 MB, dynamic import). Re-crawl: `scripts/crawl-ontological-atlas-console.js` (paste in browser console), then `node scripts/patch-personas.mjs` (re-fetches all 8 persona pages, pure Node.js + regex), then `node scripts/generate-ontological-atlas.mjs`. Key files: `src/hooks/useOntologicalAtlas.js`, `src/components/OntologicalAtlasView.jsx`.
19. **MOST TAUGHT** (`appMode === 'mosttaught'`) — Open Syllabus Project: most-taught works ranked by appearances across 9.4 million university course syllabi. 65 fields × up to 100 titles = 6,500 works. Two sections: BY FIELD (discipline group accordion → field → subfield chips → title cards) and GLOBAL TOP (cross-field top list). Subfields: 36 of 65 fields have curated keyword-matched subfield chips (e.g. Computer Science → Algorithms & Data Structures, Artificial Intelligence, Computer Networks, Databases, Cybersecurity, etc.). Each title card: rank badge, title, author, year, appearances (syllabi count in green), subfield tags, OSP external link, mode picker (10 modes). Search across all 6,500 titles or within a field. Stats bar shows total titles, fields, syllabi count, crawl date. OSP API returns 502 intermittently — when it's up, re-crawl using `scripts/crawl-osp-console.js` (paste in browser console at analytics.opensyllabus.org), copy result to `scripts/ospData.json`, re-run `node scripts/generate-osp-data.mjs` to update constants. Data: `src/constants/ospData.js` (~1 MB, dynamic import). Subfield keyword definitions in `scripts/generate-osp-data.mjs` (`SUBFIELD_DEFS`). Key files: `src/hooks/useMostTaught.js`, `src/components/MostTaughtView.jsx`.
20. **TOP SCIENTISTS** (`appMode === 'topscientists'`) — World's Top 2% Scientists (Ioannidis et al., Stanford/Elsevier, Mendeley Data DOI `10.17632/btchxktzyw`, CC BY-NC 3.0), queried **live** (not pre-crawled — the source has ~236k scientists per year/type and no static bundle would stay current) via `pasanhu.cn`'s ASMX service, proxied through `/api/topsci/query` + `/api/topsci/detail` (see Express Server Proxy Routes above for the upstream quirks: undocumented column-count-scaled page-size limit, no server-side sort param, token embedded in public page HTML). Dropdown filters: Year (2020–2024, last 5 data-update cycles), Type (Single Year / Career), Field (20 observed of 22 Science-Metrix fields), Subfield-1 (cascades from Field), Subfield-2 (unconstrained — a scientist's secondary subfield can cross fields), Country, plus free-text Author/Institution search. Sort By covers Rank/composite score, Total Citations, H-index, HM-index, Papers Count, Composite Score, Self-citation % — each direction defaults to whichever end is "best" for that metric (ascending for Rank/self%, descending for the rest). A capped-results banner appears when a non-default sort has no Field/Subfield narrowing (top 30,000 by composite score only — see `PASANHU_FETCH_ALL_CAP`). Clicking a row expands: a Claude Haiku-generated **Scientific Bio** (client-side call, same on-demand-fetch pattern used elsewhere in this app for topic descriptions — explicitly prompted not to fabricate specifics beyond field/subfield when the model has no real knowledge of the person; needs `canon_api_key`, degrades to a "set a key" message without one), a **Key Metrics** panel (full record via `/api/topsci/detail`, labels straight from pasanhu.cn's own field descriptions), a **Most Cited Publications** list — tries OpenAlex first (`fetchOpenAlexPublications` in `TopScientistsView.jsx`: author search by name reformatted "First Last", best-candidate picked by institution word-overlap + citation magnitude, then that author's top-cited works via `/works?filter=author.id:`; uses `openAlexAuth()` like every other OpenAlex call site, no key strictly required but avoids the 2026 rate-limiting — see API Keys section), falling back to Google Scholar via the `canon-enrichment` Worker's `/scholar-search` only if no confident OpenAlex author match is found (shows an inline `ScholarKeyPrompt` when the shared SerpAPI key is quota-exhausted, letting a user's own `canon_serp_key` unblock it immediately). Chosen deliberately over asking Claude to generate publications — this app's citation data is never AI-generated, and most of these ~236k scientists aren't public figures an LLM has real knowledge of, so it would confidently invent plausible-sounding fake papers rather than admit not knowing. External links (View on PASE, Google Scholar search) plus a mode picker that passes the scientist's **subfield** (not their name) as the topic to `handleDoctoralTopicClick`, since Canon/Curriculum/etc. expect a research topic. Facets (`src/constants/topSciFacets.js`, auto-generated) are a one-time crawl, not live — but a **Check for Updates** button (`GET /api/topsci/check-updates`) probes for a new year (candidateYear = max known + 1, cheap 1-row count check) and samples 500 rows of field/subfield/country values to diff against the known lists, self-healing any finds straight into `localStorage` (`topsci_extra_years`/`topsci_extra_fields`/`topsci_extra_subfields`/`topsci_extra_countries`, merged at render via `useMergedFacets()`) so a new year or facet is usable immediately without a redeploy — mirrors Academia's patch pattern. Newly-found subfields land only in the unconstrained Secondary Subfield dropdown (a flat sample can't reliably attribute them to a parent Field) until `node scripts/crawl-topsci-facets.mjs` is re-run for a proper recrawl. Key files: `src/hooks/useTopScientists.js`, `src/components/TopScientistsView.jsx`.
    - **Excel import (resilience, built)**: solves the resilience gap below. An "Offline data" panel lets a user import the official Mendeley Data `.xlsx` files (Single Year or Career, any year) directly — `src/utils/topSciImport.js` parses client-side via `xlsx` (SheetJS; **installed from `cdn.sheetjs.com`, not the npm registry package** — the npm one has an unpatched prototype-pollution/ReDoS advisory with no fix available, confirmed via `npm audit`, so `package.json` pins the CDN tarball URL instead), reading the year and type straight off the column headers (`h24 (ns)` → year 2024; `nc2424 (ns)` vs `nc9624 (ns)` → single-year vs career — same pattern `pasanhuMetricColumns()` uses server-side) rather than asking the user. Parsed rows go into IndexedDB (`src/utils/topSciLocalDb.js`, DB `topsci_local`) — files run 100k–300k+ rows, far past localStorage's ~5MB ceiling. `useTopScientists.js`'s `runQuery` automatically falls back to the matching local dataset (filtered/sorted/paginated client-side by `queryLocalDataset()`) whenever the live `/api/topsci/query` call fails outright, flagged in the UI via an `offline` banner. A successfully-imported year also self-heals into the Year dropdown immediately (same `topsci_extra_years` localStorage patch `checkForUpdates` uses) — **note**: `useMergedFacets()` takes a `version` argument specifically so this triggers a re-render; it used to memoize once on mount and silently miss a same-session import. The XLSX *decode* itself (not the row-mapping) dominates parse time — confirmed live, ~3 minutes for a 96MB/230k-row career file — inherent to unzipping+parsing the file, expect the import button to sit on "Importing…" for a while on large files.
    - **Resilience note**: pasanhu.cn is a third-party mirror, not the source of truth, and the app has no *live* scientist-level data cached beyond what a user has manually imported (see above) — the underlying dataset is permanently published on Mendeley Data/Elsevier Data Repository with a DOI (`10.17632/btchxktzyw`), versioned annually, CC BY-NC 3.0.
21. **Leading Researchers grounding** (`LeadingResearchersPanel.jsx`, currently wired into Field Intelligence's landscape tab only) — surfaces real Top-Scientists-backed researchers for whatever topic a generation mode is running, instead of letting Claude name researchers from its own training knowledge (this app's citation-adjacent data is never AI-generated — same principle as Top Scientists' publications). `src/utils/resolveTopSciSubfield.js` resolves a free-text topic to one of the 174 known subfields in two stages, escalating only as needed: (1) free, instant Jaccard word-overlap (mirrors `resolveOpenAlexTopicId`'s exact technique and 0.6 threshold — same stopwords, same scoring); (2) only if that's inconclusive, one Haiku call forced to pick from the closed subfield list or say NONE (same anti-fabrication discipline as the bio generator). No confident match → renders nothing, not a guess. Downstream of a resolved subfield there's no further fuzzy matching at all — it's a direct `/api/topsci/query?sm_subfield_1=...&sortBy=hindex` call against pasanhu.cn's own tagging, so none of the OpenAlex author-matching risk (Srivastava/Simon/Yau, see git history) applies here. Verified live: "Applied Physics" correctly surfaced Geim, Goodenough, Friend, Yan, Fu — all real leading researchers in that subfield.

## File Structure

### Hooks
- `src/hooks/useReadingPath.js` — standalone hook for concept-map reading paths; streams Claude Haiku; Phase 1 assumes zero prior knowledge (popular science / gentle primer); used by ConceptTiersView and UDCView
- `src/hooks/useCanonGenerator.js` — harvest → score → compose pipeline, streaming, refinement
- `src/hooks/useCanonHistory.js` — localStorage CRUD (key: `canon_history`, max 50)
- `src/hooks/useEnrichment.js` — background CrossRef + OpenAlex verification per canon entry
- `src/hooks/useWorkExplainer.js` — on-demand Claude Haiku explanation per work
- `src/hooks/useFieldNavigation.js` — expand/collapse state for 3-level sidebar
- `src/hooks/useReadingOrder.js` — Claude Haiku: sequences canon into gap-free reading plan, auto-triggers on canon complete
- `src/hooks/useReverseMode.js` — Claude Sonnet 5: maps prerequisites + postrequisites for any paper/book
- `src/hooks/useCurriculumMode.js` — two-phase: (1) harvest OSP, (2) Claude Sonnet 5 builds curriculum
- `src/hooks/useSpectrum.js` — two-stage: (1) Claude Sonnet 5 generates 6 candidate real-life transdisciplinary questions (no harvest), (2) selecting/typing a question triggers OSP + Semantic Scholar harvest then one streamed Claude Sonnet 5 call producing concept breakdown (uncapped) + staged reading list (uncapped) + a synthesized ANSWER section; local `streamClaude()` helper shared between both stages

### Ontological Atlas Files
- `src/hooks/useOntologicalAtlas.js` — dynamic import hook; `load()` triggers code-split import of constants; exposes `{ status, schools, works, personas, dilemmas, crawlDate, error, load }`
- `src/components/OntologicalAtlasView.jsx` — full multi-tier UI (~500 lines): 4 section tabs, dimension filter bar, universal search, memo'd card components (SchoolCard/WorkCard/PersonaCard/DilemmaCard), works pagination, scan feature, external links
- `src/constants/ontologicalAtlas.js` — auto-generated static data (1.48 MB, dynamic import). Do not edit directly — regenerate via scripts
- `scripts/crawl-ontological-atlas-console.js` — browser console crawler; paste at ontologicalatlas.com, downloads full JSON
- `scripts/patch-personas.mjs` — re-fetches all 8 persona pages from ontologicalatlas.com using pure Node.js https + regex (no jsdom); patches `scripts/ontologicalAtlas.json`
- `scripts/generate-ontological-atlas.mjs` — reads `scripts/ontologicalAtlas.json`, writes `src/constants/ontologicalAtlas.js`
- `scripts/ontologicalAtlas.json` — raw crawl data (208 schools, 1888 works, 453 personas, 57 dilemmas)

### WorkSourceLink
- `src/components/WorkSourceLink.jsx` — shared micro-component: `<WorkSourceLink title="..." isPaper={bool} />`. Books show Google Books + Scholar links; papers show Scholar only. Added to CurriculumView (textbooks + papers), DissertationView (works), CanonDriftView (works), ConsilienceView (crossReading list). FieldIntelligenceView already had its own Scholar links; CanonOutput/BookEntry already has Scholar/DOI/OA from enrichment — both unchanged.

### Utils
- `src/utils/parseCanon.js` — markdown → structured canon (sections, works)
- `src/utils/parsePrerequisites.js` — WORK/FIELD/PHASE/BEYOND/STREAM format parser
- `src/utils/parseCurriculum.js` — TOPIC/COURSE N/LEVEL/TOTAL CURRICULUM format parser
- `src/utils/parseSpectrumQuestions.js` — QUESTION N/DISCIPLINES/SPANS format parser for Spectrum's candidate question list
- `src/utils/parseSpectrumConcepts.js` — QUESTION/CONCEPT/DISCIPLINE/TIER/EXPLANATION/RELEVANCE format parser; stops at `READING LIST:`; also exports `extractReadingListSection()` (slices the raw PHASE N text between `READING LIST:` and `ANSWER:`, handed to `ReadingOrderView`) and `extractAnswerParagraphs()` (splits the text after `ANSWER:` into paragraphs)
- `src/utils/scoreWorks.js` — composite scoring: papers (citation-heavy) vs books (teaching score + editions)
- `src/utils/harvestData.js` — 8-source parallel harvest (OpenAlex ×3, Semantic Scholar ×2, Google Books, Open Library, Open Syllabus)
- `src/utils/syllabusHarvest.js` — OSP API: `syllabusSearch(topic, limit)` + `syllabusHarvest(topic)` (4 parallel queries, dedup, top 80); also exports `seminalPapersHarvest(topic)` (Semantic Scholar, sorted by `influentialCitationCount`)
- `src/utils/pulseOpenAlex.js` — OpenAlex querying helpers: `fetchTopicWorks(topicId, limit)` (exact `filter=topics.id:<id>`), `fetchTopicWorksByText(name, limit, subfieldId)` (boolean-AND text-search fallback, subfield-constrained), `resolveOpenAlexTopicId(name)` (Jaccard word-overlap match against real OpenAlex topics — same technique `resolveTopSciSubfield.js` mirrors for Top Scientists), `fetchAuthorStats(ids)` (batched career h-index/i10-index), `aggregateTopAuthors(works)`, `recentCitationVelocity(work)`. Still a real dependency of `deepDiveHarvest.js` — do not delete even though the mode that originated it (Master Reading List/Pulse) has been removed
- `src/utils/openAlexAuth.js` — `openAlexAuth()`: reads `canon_openalex_key` from localStorage, returns `&api_key=...` or `''`. Appended to every OpenAlex fetch URL across the app (9 files) — see the API Keys section above for why this exists (2026 credit-based rate limiting)
- `src/utils/openAlexTaxonomy.js` — `fetchOpenAlexTaxonomy()`: live Field → Subfield → Topic tree (19 fields, 252 subfields, 4,516 topics) from OpenAlex, each topic carrying a real topic id; cached 7 days in localStorage (`openalex_taxonomy_v2`); used by the sidebar's field/topic navigation
- `src/utils/exportMarkdown.js` — clipboard copy
- `src/utils/enrichCanon.js` — CrossRef + OpenAlex per-work enrichment
- `src/utils/openAlexEnrich.js` — FWCI, OA status, percentile from OpenAlex
- `src/constants/prompts.js` — all system prompts (canon, subfield)
- `src/constants/examples.js` — quick-fill examples
- `src/constants/fields.js` — 3-level field taxonomy (22 top-level fields)

### Components
- `src/components/ConceptTiersView.jsx` — Concept Map UI; fetches `/data/concept-map.json` on mount (no API for hierarchy); two-column layout (chips left, sticky 348px side panel right); `ExplainContent` renders ANALOGY/WHAT IT IS/REAL-LIFE EXAMPLES/WHY IT MATTERS sections; PATH/EXPLAIN tab switcher when both panels are active; `closePanel(which)` falls back to the other panel if it has content; TIER_COLORS 4 entries (violet/sky/teal/amber)
- `public/data/concept-map.json` — Static 4-tier concept map; 2,575 concepts across 170 groups; Tier 1 Foundational (9 groups, 133), Tier 2 Core Abstract Structures (13, 203), Tier 3 Fundamental Methods (32, 498), Tier 4 Specific Theories & Applied (116, 1741); covers all sciences + law, humanities, business, geography, criminology, STS
- `src/components/CanonInput.jsx` — topic input + quick generate
- `src/components/CanonOutput.jsx` — renders parsed canon; prop `noTopMargin` for tabbed view
- `src/components/ReadingOrderView.jsx` — PHASE N format, 5 color sets, loading dots
- `src/components/ReverseInput.jsx` — paste any paper/book, 4 quick-fill examples
- `src/components/PrerequisiteView.jsx` — phases (5 colors: stone/sky/violet/amber/emerald) + Postrequisites streams (dark stone-900)
- `src/components/CurriculumInput.jsx` — topic input, 6 quick-fill examples, "Build Curriculum" button
- `src/components/CurriculumView.jsx` — courses (6 colors: sky/indigo/violet/teal/emerald/amber), syllabus count badges
- `src/components/SpectrumInput.jsx` — topic textbox (generate candidate questions) with a toggle to type a question directly instead
- `src/components/SpectrumQuestionsView.jsx` — candidate question cards with discipline+tier chips and "why it spans" line; click to select and trigger the answer pipeline
- `src/components/SpectrumView.jsx` — two-column result: concept cards (plain explanation + relevance) left, `ReadingOrderView` (reused unmodified) right
- `src/components/Sidebar.jsx` — 3-level field nav + history; rendered as a `fixed top-0 right-0 h-screen w-80` panel (`App.jsx`) pinned to the true viewport right edge, not inside the centered `max-w-7xl` content column — on wide viewports it used to sit mid-page with dead space beyond it; the main content column now has `lg:pr-80` to reserve the space instead
- `src/components/ApiKeyInput.jsx` — 3 `KeyField`s: Anthropic (`canon_api_key`, required), SerpAPI (`canon_serp_key`, optional — `useCanonValidator.js` + Top Scientists' publications fallback), OpenAlex (`canon_openalex_key`, optional but see API Keys section above — effectively needed to avoid 429s everywhere OpenAlex is called)
- `src/components/ActionBar.jsx` — copy/save/regenerate/new
- `src/components/LoadingState.jsx` — phase-aware loading display
- `src/components/CandidatePreview.jsx` — live candidate list during harvest/scoring

## Data Pipeline (Canon Mode)

### Harvest (8 sources, parallel)
1. OpenAlex — papers
2. OpenAlex — books
3. OpenAlex — recent works
4. Semantic Scholar — papers
5. Semantic Scholar — textbooks ("introduction to X", "advanced X")
6. Google Books — rated textbooks
7. Open Library — classic texts (edition count signal)
8. Open Syllabus Project — `https://api.opensyllabus.org/v1/works/?q=topic&limit=25&ordering=-score`
   - Key stored as `opensyllabus_api_key` in localStorage (optional, free tier works without)

### Scoring
- Papers: 45% influential citations + 35% raw citations + 15% cross-source + 5% recency
- Books: 35% teaching score (OSP syllabusCount) + 30% editions + 15% citations + 8% ratings + cross-source bonus

### Enrichment
- CrossRef: DOI, type, author disambiguation
- OpenAlex: FWCI, Open Access URL, percentile
- Title match threshold: 0.75 (prevents same-author book collisions)
- Reprint suppression for pre-1975 works

## Canon Formats
- **Full-field** (5 sections): Orientation / Core / Technical Depth / Contemporary / Seminal Papers
- **Subfield** (3 sections): Core Textbooks / Foundational Papers / Research Monographs
- Strict ordering rule in prompts: Undergraduate → Early Graduate → Graduate → Research Level

## Prerequisites Format (useReverseMode)
Output parsed by `parsePrerequisites.js`:
```
WORK: / FIELD: / DIFFICULTY: / CONTEXT:
PHASE 0: name (Weeks range)
focus sentence
- Title by Author (Year) — rationale
  → Focus: exact chapters/sections, what to skip
TOTAL PATH: X–Y months
BEYOND: summary
STREAM 1: name / focus / works
```

## Curriculum Format (useCurriculumMode)
Output parsed by `parseCurriculum.js`:
```
TOPIC: / OVERVIEW: / LEVEL RANGE:
---
COURSE 1: name
LEVEL: Undergraduate Year 1–2 / Graduate / etc.
description sentence
- Title by Author (Year) — N university courses — core text / supplementary
  → Typically covers: chapters/topics
---
TOTAL CURRICULUM: N courses · X–Y years
```
OSP harvest: 4 parallel queries (topic, intro to topic, advanced topic, topic textbook), limit 40 each, dedup by normalized title, top 80 by syllabusCount fed to Claude.

## Key Behaviors
- Reading order auto-generates when canon completes (triggered in prevPhase useMemo in App.jsx)
- Canon + Reading Order shown in tabbed view (Canon | Reading Order toggle)
- MissingWorksPanel: flags works with 500k+ citations not in canon (red = 5k+, yellow = 500–5k)
- All mode switches clear reading order state and reset view to 'canon'
- BYOK — API key never sent anywhere except api.anthropic.com
- **Open Syllabus Project's API now returns 403 even keyless server-side** (confirmed via curl, not a CORS/browser artifact) — every mode using `syllabusHarvest`/`syllabusSearch` (Canon, Curriculum, Consilience, Dissertation, Field Intelligence) silently gets thin/empty OSP results via the existing fail-soft `catch → []` pattern. A real `opensyllabus_api_key` would likely fix this everywhere at once — not yet obtained

## CSS
- Loading dots: `.loading-dot` class (defined in index.css or App.css)
- Color system: stone-based neutral palette throughout
- No rounded corners — sharp rectangular aesthetic
