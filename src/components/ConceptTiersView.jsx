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

const CACHE_KEY = 'concept_tiers_v3';

function resolveApiKey() {
  return import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || '';
}

const TIER_SPECS = [
  { tier: 1, name: 'Mathematical Foundations',       taglineHint: 'the bedrock of all rigorous reasoning',         domain: 'Logic (propositional, first-order, modal, proof theory), set theory (ZFC, ordinals, cardinals), category theory (category, functor, adjunction, topos, Yoneda lemma), type theory, computability (Turing machine, lambda calculus, halting problem, complexity classes), model theory' },
  { tier: 2, name: 'Core Mathematical Structures',   taglineHint: 'the objects pure mathematics studies',          domain: 'Algebra (group, ring, field, module, ideal, homomorphism), linear algebra (vector space, linear map, matrix, eigenvalue, determinant, tensor), topology (topological space, metric space, compactness, connectedness, homeomorphism, homotopy), real & complex analysis (limit, continuity, derivative, integral, series, holomorphic function), measure theory (measure, Lebesgue integral, sigma-algebra, probability space), discrete math (graph, lattice, poset, combinatorics, formal language)' },
  { tier: 3, name: 'Advanced Mathematics & Physical Principles', taglineHint: 'mathematics applied to the structure of physical reality', domain: 'Differential geometry (manifold, tangent space, curvature, connection, Riemannian metric, fiber bundle), functional analysis (Hilbert space, Banach space, operator, spectrum, Fourier transform), number theory (prime, congruence, Diophantine equation, L-function, modular form), probability theory (random variable, expectation, variance, distribution, stochastic process, Markov chain), information theory (entropy, mutual information, channel capacity, Kolmogorov complexity), classical mechanics (Newton\'s laws, Lagrangian, Hamiltonian, symmetry, conservation law, phase space)' },
  { tier: 4, name: 'Core Scientific Theories',       taglineHint: 'the grand unified theories of matter, energy, and change', domain: 'Thermodynamics & statistical mechanics (entropy, free energy, partition function, phase transition, Boltzmann distribution, equation of state), electromagnetism (Maxwell\'s equations, electric field, magnetic field, electromagnetic wave, gauge invariance), quantum mechanics (wave function, Schrödinger equation, superposition, entanglement, uncertainty principle, Hilbert space formalism, operator, spin), special & general relativity (spacetime, Lorentz invariance, equivalence principle, Einstein field equations, geodesic, metric tensor), chemistry fundamentals (atomic orbital, covalent bond, ionic bond, electronegativity, reaction rate, chemical equilibrium, Gibbs free energy, oxidation state, periodic table, acid-base)' },
  { tier: 5, name: 'Life Sciences & Mind',           taglineHint: 'the principles governing living systems and cognition', domain: 'Molecular biology & genetics (DNA, RNA, protein, gene, codon, transcription, translation, mutation, replication, chromosome, epigenetics, CRISPR), cell biology (cell membrane, organelle, mitosis, meiosis, cell signaling, apoptosis, metabolism, ATP), evolutionary theory (natural selection, fitness, genetic drift, speciation, phylogeny, adaptation, sexual selection, kin selection), neuroscience (action potential, synapse, neurotransmitter, receptor, neural circuit, long-term potentiation, ion channel, membrane potential), cognitive science & psychology (perception, attention, working memory, learning, conditioning, schema, cognitive load, emotion, motivation, consciousness)' },
  { tier: 6, name: 'Complex Systems & Social Sciences', taglineHint: 'emergence, self-organisation, and collective human behaviour', domain: 'Complex systems (emergence, self-organisation, feedback loop, attractor, chaos, bifurcation, power law, network, scale-free, phase transition), earth & climate sciences (plate tectonics, rock cycle, atmospheric circulation, carbon cycle, ocean current, hydrological cycle, greenhouse effect, climate feedback), ecology (food web, ecosystem, niche, carrying capacity, population dynamics, predator-prey, biodiversity, succession), economics (utility, supply and demand, equilibrium, marginal analysis, externality, game theory, Nash equilibrium, information asymmetry, market failure, money, inflation), social science foundations (institution, social norm, social capital, collective action, power, social network, culture, language, inequality, rational choice)' },
  { tier: 7, name: 'Applied & Frontier Concepts',    taglineHint: 'knowledge deployed to build, heal, compute, and explore', domain: 'Machine learning & AI (gradient descent, backpropagation, neural network, convolutional network, transformer, attention mechanism, reinforcement learning, regularisation, embedding, loss function), medicine & physiology (homeostasis, immune response, inflammation, pharmacokinetics, receptor agonist, blood pressure, hormone, pathogen, vaccine, gene expression), engineering principles (control theory, feedback, signal processing, thermodynamic efficiency, stress and strain, circuit, semiconductor, algorithm complexity), cosmology & astrophysics (Big Bang, cosmic inflation, dark matter, dark energy, black hole, stellar evolution, nucleosynthesis, gravitational wave, Hubble constant), materials science (crystal structure, band gap, conductivity, polymer, phase diagram, dislocation, surface energy, superconductivity)' },
];

async function callTier(apiKey, spec, signal) {
  const prompt = `Generate one tier of a 7-tier concept hierarchy of all scientific knowledge.

Tier ${spec.tier} of 7: "${spec.name}"
This tier covers: ${spec.domain}

RULES:
- Output ONLY valid compact JSON — no preamble, no markdown, no trailing text
- These are CONCEPTS (intellectual primitives), NOT fields: "Vector Space" ✓, "Linear Algebra" ✗
- 6–8 groups, 8–15 concepts each

Format:
{"tier":${spec.tier},"name":"${spec.name}","tagline":"one sentence: ${spec.taglineHint}","groups":[{"name":"group label","concepts":["Concept A","Concept B"]}]}`;

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
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal,
  });

  if (!res.ok) {
    let msg = `API error ${res.status}`;
    try { const err = await res.json(); msg = err.error?.message || msg; } catch {}
    throw new Error(msg);
  }

  const body = await res.json();
  const raw = body.content?.[0]?.text || '';
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`Tier ${spec.tier}: no JSON in response`);
  return JSON.parse(m[0]);
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
    const tiers = [];
    try {
      for (const spec of TIER_SPECS) {
        if (abortRef.current?.signal.aborted) break;
        const tier = await callTier(apiKey, spec, abortRef.current.signal);
        tiers.push(tier);
        setData([...tiers]);
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(tiers));
      setStatus('done');
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
        <div className="flex items-center gap-3 py-2">
          <span className="flex gap-0.5">
            <span className="loading-dot"/><span className="loading-dot"/><span className="loading-dot"/>
          </span>
          <span className="text-sm font-mono text-stone-500">
            Generating tier {(data?.length ?? 0) + 1} of {TIER_SPECS.length} — {TIER_SPECS[data?.length ?? 0]?.name}…
          </span>
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
