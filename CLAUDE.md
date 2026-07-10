# Canon — Scholarly Reading List Generator

## Project Location
`C:\Users\prave\Projects\canon`
Dev server: `npm run dev -- --port 4000` → http://localhost:4000
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
- `canon_serp_key` — SerpAPI, optional, used by Pulse's Google Scholar panel and `useCanonValidator.js` (routed through the Cloudflare Worker, see below — never called directly, no CORS headers)
- `canon_openalex_key` — OpenAlex, optional but effectively necessary as of 2026: **OpenAlex switched to credit-based rate limiting in 2026** — keyless/mailto-only requests now 429 almost immediately (confirmed live: `Retry-After` ~20h, `$0` prepaid credit remaining). A free key (openalex.org/settings/api) restores the real `$1/day` quota. Threaded through every OpenAlex call site (9 files) via the shared `src/utils/openAlexAuth.js` → `openAlexAuth()`, which appends `&api_key=...` when the key is set. This affects far more than Pulse — the sidebar's field/topic taxonomy, Concept Search, Canon Drift, Enrichment, and the Canon Validator all call OpenAlex directly and will throttle without it.

## Cloudflare Worker (`worker/`)
Separate deploy target from the Railway app — `worker/src/index.js`, deployed via `wrangler deploy` from the `worker/` directory (requires `wrangler login` first; not deployable from this environment, no stored Cloudflare credentials). Live at `https://canon-enrichment.canonworks.workers.dev`. Holds `SERPAPI_KEY` as a Worker secret (`wrangler secret put SERPAPI_KEY`) plus a KV cache binding (`CACHE`).
- **Why it exists at all**: Google Scholar has no public API. SerpAPI (the paid proxy for it) sends no `Access-Control-Allow-Origin` header — confirmed via direct curl, not a browser quirk — so a browser calling `serpapi.com` directly always fails, and exposing a paid key client-side would be wrong even if it didn't. Every Scholar-touching feature must route through this worker instead of `serpapi.com`.
- `GET /enrich?title=&author=` — single-work lookup (title/author → best citation match by highest-cited title-overlap), used by `useEnrichment.js`/`useCanonValidator.js`-style verification. 7-day KV cache.
- `GET /scholar-search?q=&num=` — broad topic search (added for Pulse), optional `key=` query param lets a caller pass their own SerpAPI key through, which takes priority over the worker's shared `SERPAPI_KEY` secret server-side (so a BYOK user isn't limited by the shared key's quota). Only results fetched with the shared key are cached (24h KV) — a passed-through user key's results are never cached, to avoid leaking one user's results to another under the same query-only cache key.
- **Known issue**: the shared `SERPAPI_KEY` was observed returning `429` (quota/rate-limited) from the worker itself on 2026-07-08 — independent of the CORS fix. `usePulse.js`'s `scholarFailed` state and `useCanonValidator.js`'s empty-result fallback both degrade gracefully when this happens; Pulse's Google Scholar panel shows an inline prompt for the user's own key when the shared one is failing.

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
9. **Master Reading List** (`appMode === 'pulse'` — internal code/file names still say "Pulse", only the user-facing label changed) — the one Claude-free-for-its-data mode: live citation data, no LLM synthesis of the numbers themselves. Claude *is* allowed to touch topic **discovery** and the optional **Reading Order** grouping — see those notes below for exactly where that line is drawn in each case.
   - **Input**: 3 cascading dropdowns (Field → Subfield → Topic) via `fetchOpenAlexTaxonomy()`, plus an optional "✨ Suggest more topics" button.
   - **Layout**: single column per panel (a 2-up grid was tried and reverted — felt crowded once full titles were shown). Most Cited Works and Most Cited Researchers sit side by side in a 2-col row (`lg:grid-cols-2`); Most Influential Papers and Google Scholar are full-width below.
   - **Most Cited Works** — OpenAlex works for the topic, `type:article|book` only, filtered further by a hand-written noise regex (`NOISE_TITLE_RE`/`NOISE_CONTAINER_RE` in `pulseOpenAlex.js`) that drops software manuals, program docs, and bare journal/proceedings-container title stubs a broad topic node otherwise pulls in alongside real scholarship. Has its own **sort dropdown** (`WORK_SORTS` in `PulseView.jsx`): Total citations / FWCI / Percentile (same year) / Recent velocity (2yr) — this absorbed what used to be a separate standalone "Rising" panel. Each work shows a badge row: FWCI (color-coded, mirrors `BookEntry.jsx`'s `FwciBadge`), same-year percentile, type, Open Access, venue, and a **"✓ Cross-verified"** badge when the same work (matched by DOI) also appears in Most Influential Papers — the closest single signal to "seminal" the data actually supports (highly cited *and* meaningfully built-upon per Semantic Scholar, not just background-cited).
   - **Most Cited Researchers** — not a separate Authors-endpoint call (OpenAlex's authors filter has no reliable topic scoping); derived by attributing each work's citation count to every listed coauthor and ranking the running total (`aggregateTopAuthors` in `pulseOpenAlex.js`). Its own sort dropdown (`AUTHOR_SORTS`): set-scoped total citations / career H-index / works in this set. H-index comes from a separate batched call, `fetchAuthorStats()` (`filter=openalex:id1|id2|...`, capped at the top 50 authors by set-citations) — career-wide stat, not derivable from the topic-scoped works.
   - **Most Influential Papers** — Semantic Scholar batch DOI lookup against the fetched works' DOIs (precise, not a fuzzy search). The batch response's order is zipped back against the input DOI array to recover each result's DOI (Semantic Scholar doesn't echo it back), needed for the Cross-verified badge match.
   - **Google Scholar** — via the `canon-enrichment` Worker's `/scholar-search` (see Cloudflare Worker section — never call `serpapi.com` directly, no CORS headers). A user's own `canon_serp_key` takes priority over the worker's shared key; on failure the panel shows an inline key-entry prompt (`ScholarKeyPrompt`) instead of an empty state, and saving a key calls `refreshScholar()` to backfill just that panel.
   - **Claude-suggested topics** (`useTopicSuggestions.js`, one non-streaming Haiku call): the "✨ Suggest more topics" button asks Claude for 15–20 specific topics within the selected Field/Subfield (useful since a fixed OpenAlex taxonomy node can be too coarse), shown in their own labeled `<optgroup>` apart from native OpenAlex topics. Picking one goes through a precision pipeline in `usePulse.js`'s `select()`, in order:
     1. **`resolveOpenAlexTopicId(name)`** (`pulseOpenAlex.js`) — checks OpenAlex's own `/topics?search=` for a close match (Jaccard word-overlap ≥ 0.6 against `display_name`) first, since a Claude-suggested name was explicitly prompted to be phrased like a real research topic. A match uses the same exact `topics.id` filter as a native pick — full precision, zero further Claude involvement, `isTextMatch` stays false.
     2. If no confident match, falls back to **`fetchTopicWorksByText(name, limit, subfieldId)`** — a boolean-AND search (`booleanAndQuery`: joins the name's stopword-stripped significant words with literal `AND`) constrained by `filter=topics.subfield.id:<the selected subfield>`. Plain `search=` + `sort=cited_by_count:desc` was tried first and found broken: OpenAlex's relevance scoring is itself citation-boosted, so a loose multi-word match sorted by citations surfaces whatever's most-cited *globally* among barely-related hits (confirmed live: "Modular forms and L-functions" returned lme4, LeCun's CNN paper, SciPy ahead of any actual number theory). The subfield filter alone still isn't airtight — a work can legitimately carry multiple OpenAlex subfields (confirmed: Lions' calculus-of-variations paper is tagged "Mathematical Physics" and mentions "quantum field theory" in passing, so it passed both the AND query and the subfield filter for "Topological Quantum Field Theory" despite the paper not being about it).
     3. **`claudeValidateWorks(topicName, works)`** (in `usePulse.js`) — only runs on the text-search fallback path (step 2), never after an exact `topics.id` match (native or resolved). One Haiku call: given the topic name and the fetched titles/authors/years, keep only the ones genuinely about it. Fails soft to the unfiltered list on any API/parsing error — showing possibly-noisy results beats a blank panel from a transient failure. Sets `wasClaudeValidated`, which the Works panel subtitle and empty-state text read directly, so the UI always discloses exactly which precision path produced what's on screen (exact-filtered / Claude-checked text match / nothing survived the check).
   - **Reading Order view** (Works panel only, opt-in via a `Ranked | ✨ Reading Order` toggle — default is always `Ranked`, so picking a topic never runs this automatically): `classifyWorksByStage()` (`usePulse.js`) sends the fetched titles/authors/years to Claude Haiku and places each into exactly one of a fixed six-stage pedagogical sequence (`READING_STAGES`, exported from `usePulse.js` so `PulseView.jsx` renders group headers in the same order without duplicating the list): Historical Context & Intuition → Foundational Textbooks → Mathematical Rigor → Advanced Concepts → Specialized Topics → Philosophical Frameworks. None of these six are derivable from citation metadata — placing a specific work requires judging what it's actually about. Classification is cached per topic (`readingStages` state, `null` until requested) and keyed by each work's stable index into the *original* `mostCited` array (attached as `originalIndex` before any client-side re-sort, so the mapping survives switching the ranked-view sort dropdown). Toggling back to `Ranked` and back to `Reading Order` reuses the cached classification — no re-fetch. Works within each stage are still ordered by citation count. The panel subtitle explicitly flags that the *grouping* (not the numbers) is AI-assigned while in this view.
10. **Field Intelligence** (`appMode === 'intelligence'`) — 3-tab deep analysis: Landscape (all schools of thought), Audit (hidden assumptions + paradigm), Bibliography (exhaustive annotated bibliography with reading order + click-to-expand synopsis)
11. **Math Universe** (`appMode === 'math'`) — browse 15 math domains → subfields → topic chips → ordered reading sequence + beginner explanations
12. **Concept Map** (`appMode === 'concepts'`) — 4-tier static hierarchy of 2,575 concepts across 170 groups covering all of human knowledge (science, mathematics, medicine, law, humanities, business); loaded instantly from `public/data/concept-map.json` (no API calls for hierarchy); two-column layout: chips left, sticky 348px side panel right; side panel shows reading path OR explanation with PATH/EXPLAIN tabs when both are active
13. **Doctoral Topics** (`appMode === 'doctoral'`) — browse 1,405 academic subjects and 280,700 PhD research topics from phd.nthrys.com. Static data (code-split via dynamic import, ~3.4 MB gzip, only loads on demand). Accordion UI: click subject → expands topic list. Click any topic → inline mode picker with 9 buttons (Canon / Curriculum / Dissertation / Prerequisites / Canon Drift / Consilience / Inquiry / Spectrum / Field Intelligence). Each topic has a hover external-link icon → phd.nthrys.com page. "Check for Updates" button fetches new topics via corsproxy.io CORS proxy, diffs against current data, saves patches to localStorage key `doctoral_topics_patches`. Tab click auto-triggers `doctoral.load()` only if status is still 'idle'.
14. **UDC** (`appMode === 'udc'`) — Universal Decimal Classification browser, sourced from ETH-UDK (eth-udk.library.ethz.ch). Loads `public/data/udc-full.json` (9,237 hierarchical nodes, 9 main classes). Global mode selector (10 modes: Reading Path / Canon / Curriculum / Dissertation / Canon Drift / Consilience / Inquiry / Prerequisites / Spectrum / Field Intel) — clicking any node generates in the selected mode. Reading Path is handled inline (no tab switch), all other modes switch tab and trigger generation via `handleDoctoralTopicClick`. "Check for New Codes" button hits `/api/udc-new-terms` (server-side proxy, no CORS issues) which fetches `eth-udk.library.ethz.ch/new-terms/eng`, parses label+code+date, returns JSON; new entries are diffed against localStorage (`udc_new_codes`) and saved as patches; shown in a "New Codes" section grouped by date. Search covers both the static hierarchy and new codes simultaneously. WorldCat link per node.

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
- `src/hooks/usePulse.js` — orchestrates the whole Master Reading List pipeline (see mode 9 above for the full precision-pipeline breakdown: `resolveOpenAlexTopicId` → `fetchTopicWorksByText` → `claudeValidateWorks`, only the last of which calls Claude and only on the text-search fallback path). Also runs `aggregateTopAuthors` + the batched `fetchAuthorStats` for Most Cited Researchers, and a Semantic Scholar batch DOI lookup (zipping the doi back into each result by index, since Semantic Scholar doesn't echo it) for Most Influential Papers / the Cross-verified badge. Tracks `scholarFailed` (true on any fetch/worker error, not just "no key"), `isTextMatch`, and `wasClaudeValidated`; exports `refreshScholar()`, called after a key is saved from the panel's own inline prompt, to backfill just the Scholar panel. Also exports `READING_STAGES` (the fixed 6-stage order) and `loadReadingStages()`/`readingStages`/`readingStagesLoading`/`readingStagesFailed` for the opt-in Reading Order view (see mode 9 above). Phases `idle → loading → complete/error`, no "harvesting"/"generating" split since there's no LLM stage on the main path
- `src/hooks/useTopicSuggestions.js` — one non-streaming Haiku call (mirrors `useWorkExplainer.js`'s pattern): given a Field + Subfield, returns 15–20 specific topic name suggestions for Pulse's "Claude-suggested topics" optgroup. Not used for anything else — topic *discovery* only, never touches displayed data

### Doctoral Topics Files
- `src/hooks/useDoctoralTopics.js` — dynamic `import()` of static data (keeps it out of main bundle); loads static base + merges localStorage patches; `checkForUpdates(currentTopicsBySubject)` fetches all 13 sitemaps via `https://corsproxy.io/?url=...`, parses level-2 URLs, diffs, saves new topics to `doctoral_topics_patches` in localStorage
- `src/components/DoctoralTopicsView.jsx` — accordion + search + inline mode picker (9 modes) + hover source link per topic + Check for Updates button + update count banner
- `src/constants/doctoralTopics.js` — auto-generated static data (1,405 subjects, 280,700 topics). Run `node scripts/crawl-doctoral-topics.mjs` to regenerate, then redeploy
- `scripts/crawl-doctoral-topics.mjs` — Node.js script: fetches all 13 sitemaps from phd.nthrys.com, parses `/subject/topic` URL paths, outputs `src/constants/doctoralTopics.js`

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
- `src/utils/pulseOpenAlex.js` — all of Pulse's OpenAlex querying: `fetchTopicWorks(topicId, limit)` (exact `filter=topics.id:<id>`), `fetchTopicWorksByText(name, limit, subfieldId)` (boolean-AND text-search fallback, subfield-constrained — see mode 9 above), `resolveOpenAlexTopicId(name)` (Jaccard-match a Claude-suggested name against real OpenAlex topics), `fetchAuthorStats(ids)` (batched career h-index/i10-index), `aggregateTopAuthors(works)` (derives Most Cited Researchers from the works already fetched), `recentCitationVelocity(work)` (sums the 2 most recent years from `counts_by_year`, one of the Works panel's sort options). `select` includes `counts_by_year`, `cited_by_percentile_year` — not fetched anywhere else in the app
- `src/utils/openAlexAuth.js` — `openAlexAuth()`: reads `canon_openalex_key` from localStorage, returns `&api_key=...` or `''`. Appended to every OpenAlex fetch URL across the app (9 files) — see the API Keys section above for why this exists (2026 credit-based rate limiting)
- `src/utils/openAlexTaxonomy.js` — `fetchOpenAlexTaxonomy()`: live Field → Subfield → Topic tree (19 fields, 252 subfields, 4,516 topics) from OpenAlex, each topic carrying a real topic id; cached 7 days in localStorage (`openalex_taxonomy_v2`); used by the sidebar and by `PulseInput.jsx`'s cascading dropdowns
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
- `src/components/PulseInput.jsx` — 3 cascading dropdowns (Field → Subfield → Topic) via `fetchOpenAlexTaxonomy()`; selecting a native leaf topic fires the fetch immediately, no button. Plus a "✨ Suggest more topics" button (`useTopicSuggestions.js`) that adds a second `<optgroup>` of Claude-suggested names to the Topic dropdown; picking one passes `(null, name, subfieldId)` to `onSelect` instead of `(url, name)`, signaling `usePulse.js` to run the text-search/validation fallback path
- `src/components/PulseView.jsx` — single-column ranked-list panels (`Panel` shared renderer): Most Cited Works + Most Cited Researchers side by side (`lg:grid-cols-2`), each with its own metric sort `<select>` (`WORK_SORTS`/`AUTHOR_SORTS`); Most Influential Papers + Google Scholar full-width below. Works get a badge row (FWCI/percentile/type/OA/venue/Cross-verified) via `workBadges()`. Subtitle text on the Works panel (`worksSubtitle()`) discloses which precision path produced the results — exact-filtered, Claude-checked text match, or (empty state) nothing survived the check. Google Scholar's empty state is `ScholarKeyPrompt` (inline key input) when `scholarFailed`
- `src/components/Sidebar.jsx` — 3-level field nav + history; rendered as a `fixed top-0 right-0 h-screen w-80` panel (`App.jsx`) pinned to the true viewport right edge, not inside the centered `max-w-7xl` content column — on wide viewports it used to sit mid-page with dead space beyond it; the main content column now has `lg:pr-80` to reserve the space instead
- `src/components/ApiKeyInput.jsx` — 3 `KeyField`s: Anthropic (`canon_api_key`, required), SerpAPI (`canon_serp_key`, optional — Pulse's Google Scholar panel + `useCanonValidator.js`), OpenAlex (`canon_openalex_key`, optional but see API Keys section above — effectively needed to avoid 429s everywhere OpenAlex is called)
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
- **Open Syllabus Project's API now returns 403 even keyless server-side** (confirmed via curl, not a CORS/browser artifact) — every mode using `syllabusHarvest`/`syllabusSearch` (Canon, Curriculum, Consilience, Dissertation, Field Intelligence) silently gets thin/empty OSP results via the existing fail-soft `catch → []` pattern. Pulse dropped its OSP panel entirely for this reason. A real `opensyllabus_api_key` would likely fix this everywhere at once — not yet obtained

## CSS
- Loading dots: `.loading-dot` class (defined in index.css or App.css)
- Color system: stone-based neutral palette throughout
- No rounded corners — sharp rectangular aesthetic
