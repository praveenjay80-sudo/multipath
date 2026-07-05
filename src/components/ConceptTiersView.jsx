import { useState, useEffect, useRef } from 'react';
import { useReadingPath } from '../hooks/useReadingPath';
import ReadingOrderView from './ReadingOrderView';

const TIER_COLORS = [
  { bg: 'bg-violet-700',  text: 'text-violet-700',  chip: 'hover:bg-violet-700  hover:text-white hover:border-violet-700'  },
  { bg: 'bg-indigo-700',  text: 'text-indigo-700',  chip: 'hover:bg-indigo-700  hover:text-white hover:border-indigo-700'  },
  { bg: 'bg-blue-700',    text: 'text-blue-700',    chip: 'hover:bg-blue-700    hover:text-white hover:border-blue-700'    },
  { bg: 'bg-sky-700',     text: 'text-sky-700',     chip: 'hover:bg-sky-700     hover:text-white hover:border-sky-700'     },
  { bg: 'bg-teal-700',    text: 'text-teal-700',    chip: 'hover:bg-teal-700    hover:text-white hover:border-teal-700'    },
  { bg: 'bg-amber-700',   text: 'text-amber-700',   chip: 'hover:bg-amber-700   hover:text-white hover:border-amber-700'   },
  { bg: 'bg-rose-700',    text: 'text-rose-700',    chip: 'hover:bg-rose-700    hover:text-white hover:border-rose-700'    },
];

const CACHE_KEY = 'concept_tiers_v2';

function resolveApiKey() {
  return import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || '';
}

const GENERATION_PROMPT = `Generate a comprehensive 7-tier hierarchy of ALL fundamental scientific concepts across every domain of human knowledge, ordered from most abstract to most applied.

IMPORTANT — these are CONCEPTS (intellectual primitives), NOT fields or disciplines:
✓ GOOD: "Vector Space", "Natural Selection", "Action Potential", "Nash Equilibrium", "Entropy", "Covalent Bond"
✗ BAD: "Linear Algebra", "Evolutionary Biology", "Neuroscience", "Economics"

Tier structure:
- Tier 1: Pure logic, foundations of mathematics, computability — bedrock of all reasoning
- Tier 2: Core mathematical structures — algebra, topology, analysis, measure theory, discrete math
- Tier 3: Advanced mathematics, probability, information theory, classical physical principles
- Tier 4: Core scientific theories — quantum mechanics, relativity, thermodynamics, chemical foundations
- Tier 5: Life sciences, neuroscience, cognitive science, evolutionary theory
- Tier 6: Complex systems, earth sciences, economics, social science, ecology
- Tier 7: Applied concepts — machine learning, medicine, engineering, cosmology, materials

Output ONLY valid compact JSON, no preamble or trailing text:
[{"tier":1,"name":"...","tagline":"one sentence on why this tier sits here","groups":[{"name":"...","concepts":["Concept A","Concept B",...]},...]}]

Requirements:
- 6-10 groups per tier
- 8-20 concepts per group
- Total 600+ concepts — be comprehensive, leave nothing major out
- Cover: mathematics, logic, physics, chemistry, biology, genetics, neuroscience, psychology, economics, earth sciences, ecology, computer science, cosmology, materials science
- Every concept must be a named primitive that unlocks understanding of things above it in the hierarchy`;

async function callGenerate(apiKey, signal) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8000,
      messages: [{ role: 'user', content: GENERATION_PROMPT }],
    }),
    signal,
  });

  if (!res.ok) {
    let msg = `API error ${res.status}`;
    try { const err = await res.json(); msg = err.error?.message || msg; } catch {}
    throw new Error(msg);
  }

  const data = await res.json();
  return data.content?.[0]?.text || '';
}

export default function ConceptTiersView({ onGenerate }) {
  const [data,     setData]     = useState(null);
  const [status,   setStatus]   = useState('idle'); // idle | loading | done | error
  const [errorMsg, setErrorMsg] = useState('');
  const abortRef = useRef(null);
  const readingPath = useReadingPath();

  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) { setData(JSON.parse(cached)); setStatus('done'); return; }
    } catch {}
    generate();
    return () => abortRef.current?.abort();
  }, []);

  async function generate() {
    const apiKey = resolveApiKey();
    if (!apiKey) { setErrorMsg('No API key — enter your Anthropic key in the header.'); setStatus('error'); return; }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setStatus('loading'); setData(null); setErrorMsg('');
    try {
      const raw = await callGenerate(apiKey, abortRef.current.signal);
      const m = raw.match(/\[[\s\S]*\]/);
      if (!m) throw new Error(`Response did not contain JSON (got ${raw.length} chars): ${raw.slice(0, 200)}`);
      const parsed = JSON.parse(m[0]);
      localStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
      setData(parsed); setStatus('done');
    } catch (e) {
      if (e.name !== 'AbortError') { setErrorMsg(e.message); setStatus('error'); }
    }
  }

  const totalConcepts = data
    ? data.reduce((s, t) => s + t.groups.reduce((ss, g) => ss + g.concepts.length, 0), 0)
    : 0;

  return (
    <div className="mt-8 space-y-6">
      {/* Header */}
      <div className="border-b border-stone-200 pb-4">
        <div className="flex items-baseline gap-3 mb-1">
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Concept Hierarchy of Science</h2>
          {status === 'done' && (
            <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-stone-800 text-white">
              {totalConcepts} concepts · 7 tiers
            </span>
          )}
        </div>
        <p className="text-sm text-stone-500 max-w-2xl">
          All fundamental scientific concepts — from pure logic to applied models — ordered by generality.
          Click any concept to generate a reading path.
        </p>
        {status === 'done' && (
          <button onClick={generate}
            className="mt-2 text-[10px] font-mono text-stone-400 hover:text-stone-700 underline">
            Regenerate
          </button>
        )}
      </div>

      {/* Loading state */}
      {status === 'loading' && (
        <div className="flex items-center gap-3 py-4">
          <span className="flex gap-0.5">
            <span className="loading-dot"/><span className="loading-dot"/><span className="loading-dot"/>
          </span>
          <span className="text-sm font-mono text-stone-500">Generating concept hierarchy — takes ~30s…</span>
        </div>
      )}

      {status === 'error' && (
        <div className="py-4 space-y-2">
          <div className="text-sm font-mono text-red-600">{errorMsg || 'Unknown error'}</div>
          <button onClick={generate} className="text-xs font-mono underline text-stone-500 hover:text-stone-800">Retry</button>
        </div>
      )}

      {/* Tier blocks */}
      {data && data.map((tier, ti) => {
        const c = TIER_COLORS[ti] || TIER_COLORS[6];
        const tierTotal = tier.groups.reduce((s, g) => s + g.concepts.length, 0);
        return (
          <div key={tier.tier} className="border border-stone-200">
            {/* Tier header */}
            <div className={`px-4 py-3 ${c.bg} text-white`}>
              <div className="flex items-baseline gap-3">
                <span className="text-[9px] font-mono font-bold opacity-60 tracking-widest">TIER {tier.tier}</span>
                <span className="font-bold text-sm">{tier.name}</span>
                <span className="text-[9px] font-mono opacity-50 ml-auto">{tierTotal} concepts</span>
              </div>
              <p className="text-[11px] opacity-75 mt-0.5 leading-snug">{tier.tagline}</p>
            </div>

            {/* Groups */}
            <div className="p-4 space-y-4 bg-white">
              {tier.groups.map((group, gi) => (
                <div key={gi}>
                  <div className={`text-[9px] font-mono font-bold uppercase tracking-widest mb-2 ${c.text}`}>
                    {group.name}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.concepts.map((concept, ci) => {
                      const isActive = readingPath.topic === concept;
                      return (
                        <button
                          key={ci}
                          onClick={() => readingPath.generate(concept)}
                          className={`text-[11px] font-mono px-2 py-1 border transition-all ${
                            isActive
                              ? `${c.bg} text-white border-transparent`
                              : `bg-white text-stone-700 border-stone-200 ${c.chip}`
                          }`}
                        >
                          {concept}
                          {isActive && (
                            <span className="ml-1 opacity-75 text-[9px]">
                              {readingPath.status === 'loading' ? '···' : '◆'}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Inline Reading Path */}
      {readingPath.status !== 'idle' && (
        <div className="border border-stone-200 bg-white">
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 bg-stone-50">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-stone-700">Reading Path</span>
              <span className="text-sm text-stone-500">{readingPath.topic}</span>
              {readingPath.status === 'loading' && (
                <span className="flex gap-0.5">
                  <span className="loading-dot"/><span className="loading-dot"/><span className="loading-dot"/>
                </span>
              )}
            </div>
            <button onClick={readingPath.clear}
              className="text-[9px] font-mono text-stone-400 hover:text-stone-700 px-2 py-0.5 border border-stone-200 hover:border-stone-400 transition-colors">
              ✕ close
            </button>
          </div>
          <div className="p-4">
            <ReadingOrderView content={readingPath.content} isStreaming={readingPath.status === 'loading'} />
          </div>
        </div>
      )}
    </div>
  );
}
