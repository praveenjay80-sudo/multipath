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

## File Structure

### Hooks
- `src/hooks/useCanonGenerator.js` — harvest → score → compose pipeline, streaming, refinement
- `src/hooks/useCanonHistory.js` — localStorage CRUD (key: `canon_history`, max 50)
- `src/hooks/useEnrichment.js` — background CrossRef + OpenAlex verification per canon entry
- `src/hooks/useWorkExplainer.js` — on-demand Claude Haiku explanation per work
- `src/hooks/useFieldNavigation.js` — expand/collapse state for 3-level sidebar
- `src/hooks/useReadingOrder.js` — Claude Haiku: sequences canon into gap-free reading plan, auto-triggers on canon complete
- `src/hooks/useReverseMode.js` — Claude Sonnet 5: maps prerequisites + postrequisites for any paper/book
- `src/hooks/useCurriculumMode.js` — two-phase: (1) harvest OSP, (2) Claude Sonnet 5 builds curriculum

### Utils
- `src/utils/parseCanon.js` — markdown → structured canon (sections, works)
- `src/utils/parsePrerequisites.js` — WORK/FIELD/PHASE/BEYOND/STREAM format parser
- `src/utils/parseCurriculum.js` — TOPIC/COURSE N/LEVEL/TOTAL CURRICULUM format parser
- `src/utils/scoreWorks.js` — composite scoring: papers (citation-heavy) vs books (teaching score + editions)
- `src/utils/harvestData.js` — 8-source parallel harvest (OpenAlex ×3, Semantic Scholar ×2, Google Books, Open Library, Open Syllabus)
- `src/utils/syllabusHarvest.js` — OSP API: `syllabusSearch(topic, limit)` + `syllabusHarvest(topic)` (4 parallel queries, dedup, top 80)
- `src/utils/exportMarkdown.js` — clipboard copy
- `src/utils/enrichCanon.js` — CrossRef + OpenAlex per-work enrichment
- `src/utils/openAlexEnrich.js` — FWCI, OA status, percentile from OpenAlex
- `src/constants/prompts.js` — all system prompts (canon, subfield)
- `src/constants/examples.js` — quick-fill examples
- `src/constants/fields.js` — 3-level field taxonomy (22 top-level fields)

### Components
- `src/components/CanonInput.jsx` — topic input + quick generate
- `src/components/CanonOutput.jsx` — renders parsed canon; prop `noTopMargin` for tabbed view
- `src/components/ReadingOrderView.jsx` — PHASE N format, 5 color sets, loading dots
- `src/components/ReverseInput.jsx` — paste any paper/book, 4 quick-fill examples
- `src/components/PrerequisiteView.jsx` — phases (5 colors: stone/sky/violet/amber/emerald) + Postrequisites streams (dark stone-900)
- `src/components/CurriculumInput.jsx` — topic input, 6 quick-fill examples, "Build Curriculum" button
- `src/components/CurriculumView.jsx` — courses (6 colors: sky/indigo/violet/teal/emerald/amber), syllabus count badges
- `src/components/Sidebar.jsx` — 3-level field nav + history
- `src/components/ApiKeyInput.jsx` — Anthropic key input (localStorage `canon_api_key`)
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
