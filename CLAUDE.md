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
9. **Pulse** (`appMode === 'pulse'`) — the one Claude-free mode: live citation and syllabus data, no LLM synthesis at all. Input is 3 cascading dropdowns (Field → Subfield → Topic) via `fetchOpenAlexTaxonomy()`, not free text — selecting a leaf Topic (real OpenAlex topic ID) fires 4 parallel live fetches: OpenAlex works filtered by exact topic ID (Most Cited + Rising, the latter re-sorted client-side by 2-year citation velocity from `counts_by_year`), Semantic Scholar cross-referenced by the DOIs of those same OpenAlex works via a batch lookup (Most Influential Papers — precise, not a separate fuzzy search), Open Syllabus Project text-matched by topic name (Most Assigned — labeled as approximate since OSP has no ID filter), and optionally Google Scholar via SerpAPI if a `canon_serp_key` is set (also text-matched). All 5 panels are plain ranked lists — title/authors/year + a mono metric chip, no prose
10. **Field Intelligence** (`appMode === 'intelligence'`) — 3-tab deep analysis: Landscape (all schools of thought), Audit (hidden assumptions + paradigm), Bibliography (exhaustive annotated bibliography with reading order + click-to-expand synopsis)
11. **Math Universe** (`appMode === 'math'`) — browse 15 math domains → subfields → topic chips → ordered reading sequence + beginner explanations
12. **Concept Map** (`appMode === 'concepts'`) — 4-tier static hierarchy of 2,575 concepts across 170 groups covering all of human knowledge (science, mathematics, medicine, law, humanities, business); loaded instantly from `public/data/concept-map.json` (no API calls for hierarchy); two-column layout: chips left, sticky 348px side panel right; side panel shows reading path OR explanation with PATH/EXPLAIN tabs when both are active

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
- `src/hooks/usePulse.js` — no Claude call. On topic selection: OpenAlex works filtered by exact topic id (`pulseOpenAlex.js`) in parallel with OSP `syllabusSearch()` and (if `canon_serp_key` is set) a Google Scholar SerpAPI search; then a Semantic Scholar batch DOI lookup against the OpenAlex results' DOIs for the "Most Influential" cross-reference. Phases `idle → loading → complete/error`, no "harvesting"/"generating" split since there's no LLM stage

### Utils
- `src/utils/parseCanon.js` — markdown → structured canon (sections, works)
- `src/utils/parsePrerequisites.js` — WORK/FIELD/PHASE/BEYOND/STREAM format parser
- `src/utils/parseCurriculum.js` — TOPIC/COURSE N/LEVEL/TOTAL CURRICULUM format parser
- `src/utils/parseSpectrumQuestions.js` — QUESTION N/DISCIPLINES/SPANS format parser for Spectrum's candidate question list
- `src/utils/parseSpectrumConcepts.js` — QUESTION/CONCEPT/DISCIPLINE/TIER/EXPLANATION/RELEVANCE format parser; stops at `READING LIST:`; also exports `extractReadingListSection()` (slices the raw PHASE N text between `READING LIST:` and `ANSWER:`, handed to `ReadingOrderView`) and `extractAnswerParagraphs()` (splits the text after `ANSWER:` into paragraphs)
- `src/utils/scoreWorks.js` — composite scoring: papers (citation-heavy) vs books (teaching score + editions)
- `src/utils/harvestData.js` — 8-source parallel harvest (OpenAlex ×3, Semantic Scholar ×2, Google Books, Open Library, Open Syllabus)
- `src/utils/syllabusHarvest.js` — OSP API: `syllabusSearch(topic, limit)` + `syllabusHarvest(topic)` (4 parallel queries, dedup, top 80); also exports `seminalPapersHarvest(topic)` (Semantic Scholar, sorted by `influentialCitationCount`)
- `src/utils/pulseOpenAlex.js` — `fetchTopicWorks(topicId, limit)`: OpenAlex `/works?filter=topics.id:<id>` (exact topic-id filter, not text search), `select` includes `counts_by_year` (not fetched anywhere else in the app); `recentCitationVelocity(work)` sums the 2 most recent years from `counts_by_year` for the Pulse "Rising" sort
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
- `src/components/PulseInput.jsx` — 3 cascading dropdowns (Field → Subfield → Topic) via `fetchOpenAlexTaxonomy()`; selecting a leaf topic fires the fetch immediately, no button
- `src/components/PulseView.jsx` — 5 plain ranked-list panels (Most Cited, Rising, Most Influential Papers, Most Assigned, Google Scholar), shared `Panel` renderer, mono metric chips, no prose
- `src/components/Sidebar.jsx` — 3-level field nav + history
- `src/components/ApiKeyInput.jsx` — Anthropic key input (localStorage `canon_api_key`) + optional SerpAPI key (localStorage `canon_serp_key`, used by Pulse's Google Scholar panel and `useCanonValidator.js`)
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

## CSS
- Loading dots: `.loading-dot` class (defined in index.css or App.css)
- Color system: stone-based neutral palette throughout
- No rounded corners — sharp rectangular aesthetic
