import { useState, useRef, useEffect } from 'react';
import { useReadingPath } from '../hooks/useReadingPath';
import ReadingOrderView from './ReadingOrderView';

const TIER_COLORS = [
  { bg: 'bg-violet-700',  text: 'text-violet-700',  active: 'bg-violet-700 text-white border-violet-700',  hover: 'hover:bg-violet-700 hover:text-white hover:border-violet-700'  },
  { bg: 'bg-indigo-700',  text: 'text-indigo-700',  active: 'bg-indigo-700 text-white border-indigo-700',  hover: 'hover:bg-indigo-700 hover:text-white hover:border-indigo-700'  },
  { bg: 'bg-blue-700',    text: 'text-blue-700',    active: 'bg-blue-700 text-white border-blue-700',      hover: 'hover:bg-blue-700 hover:text-white hover:border-blue-700'      },
  { bg: 'bg-sky-700',     text: 'text-sky-700',     active: 'bg-sky-700 text-white border-sky-700',        hover: 'hover:bg-sky-700 hover:text-white hover:border-sky-700'        },
  { bg: 'bg-teal-700',    text: 'text-teal-700',    active: 'bg-teal-700 text-white border-teal-700',      hover: 'hover:bg-teal-700 hover:text-white hover:border-teal-700'      },
  { bg: 'bg-amber-700',   text: 'text-amber-700',   active: 'bg-amber-700 text-white border-amber-700',    hover: 'hover:bg-amber-700 hover:text-white hover:border-amber-700'    },
  { bg: 'bg-rose-700',    text: 'text-rose-700',    active: 'bg-rose-700 text-white border-rose-700',      hover: 'hover:bg-rose-700 hover:text-white hover:border-rose-700'      },
];

const CACHE_KEY = 'concept_tiers_v4';

const TIER_SPECS = [
  {
    tier: 1,
    name: 'Mathematical Foundations',
    taglineHint: 'the bedrock of all rigorous reasoning — before physics, before science, before everything',
    domain: 'Logic (propositional logic, first-order logic, modal logic, proof theory, Gödel incompleteness theorems, model theory, completeness theorem, soundness), set theory (ZFC axioms, ordinal, cardinal, power set, Cantor theorem, axiom of choice, well-ordering theorem, Russell paradox), category theory (category, functor, natural transformation, adjunction, Yoneda lemma, topos, limit, colimit, universal property, monad), type theory (simple type theory, dependent type, Curry-Howard correspondence, propositions as types, homotopy type theory), computability theory (Turing machine, lambda calculus, Church-Turing thesis, halting problem, decidability, recursive function, Rice theorem, Kolmogorov complexity), computational complexity (P vs NP, NP-completeness, reduction, polynomial hierarchy, space complexity, circuit complexity, randomised complexity), constructive mathematics (intuitionistic logic, constructive proof, realizability, Brouwer intuitionism), order theory (partial order, total order, lattice, Boolean algebra, Heyting algebra, Galois connection), proof theory (sequent calculus, natural deduction, cut elimination, ordinal analysis)',
  },
  {
    tier: 2,
    name: 'Core Mathematical Structures',
    taglineHint: 'the abstract objects that pure mathematics studies and all other sciences borrow',
    domain: 'Algebra (group, subgroup, normal subgroup, quotient group, ring, field, module, ideal, homomorphism, isomorphism, Galois theory, splitting field, solvability by radicals, representation theory, character theory), linear algebra (vector space, basis, dimension, linear map, matrix, rank, determinant, eigenvalue, eigenvector, diagonalisation, Jordan form, singular value decomposition, inner product space, tensor product, multilinear algebra), topology (topological space, open set, continuous map, compactness, connectedness, homeomorphism, homotopy, fundamental group, covering space, Euler characteristic, CW complex), real analysis (limit, continuity, derivative, Riemann integral, series convergence, uniform convergence, completeness, Baire category theorem, implicit function theorem, inverse function theorem), complex analysis (holomorphic function, Cauchy-Riemann equations, Cauchy integral theorem, residue theorem, analytic continuation, Riemann mapping theorem, Riemann surface, meromorphic function), measure theory (sigma-algebra, measure space, Lebesgue measure, almost everywhere convergence, Lp space, Radon-Nikodym theorem, Fubini theorem, signed measure), discrete mathematics (graph, tree, matching, colouring, poset, permutation, combination, generating function, recurrence relation, Ramsey theory, extremal combinatorics, linear programming duality)',
  },
  {
    tier: 3,
    name: 'Advanced Mathematics & Physical Principles',
    taglineHint: 'mathematics shaped to describe space, change, randomness, and information',
    domain: 'Differential geometry (smooth manifold, tangent bundle, Riemannian metric, Levi-Civita connection, curvature tensor, geodesic, differential form, de Rham cohomology, Lie group, Lie algebra, principal fiber bundle, characteristic class, Stokes theorem, symplectic manifold), functional analysis (Hilbert space, Banach space, bounded operator, spectral theorem, Fourier transform, Schwartz distribution, Sobolev space, compact operator, Fredholm operator, trace-class operator), ordinary differential equations (existence and uniqueness, phase portrait, linearisation, stability, Lyapunov function, bifurcation, limit cycle, Poincaré-Bendixson, Floquet theory, Hamiltonian systems), partial differential equations (Laplace equation, heat equation, wave equation, characteristics, weak solution, elliptic regularity, variational formulation, Sobolev embedding, finite element method, viscosity solution), number theory (prime number theorem, modular arithmetic, quadratic reciprocity, p-adic numbers, Dirichlet series, L-function, modular form, elliptic curve, cryptographic applications, analytic number theory), probability theory (probability space, random variable, expectation, variance, conditional probability, Bayes theorem, law of large numbers, central limit theorem, large deviations, Brownian motion, martingale, stochastic differential equation, Markov chain, Poisson process), information theory (Shannon entropy, mutual information, channel capacity, data compression, source coding theorem, rate-distortion theory, Kolmogorov complexity, error-correcting code, LDPC code), algebraic geometry (affine variety, projective space, scheme, sheaf, cohomology, divisor, Riemann-Roch theorem, intersection theory), classical mechanics (Newton laws, Lagrangian mechanics, Hamiltonian mechanics, phase space, symplectic structure, action principle, Noether theorem, integrable system, chaos, KAM theorem)',
  },
  {
    tier: 4,
    name: 'Core Scientific Theories',
    taglineHint: 'the grand theories unifying matter, energy, space, time, and chemical change',
    domain: 'Thermodynamics and statistical mechanics (temperature, entropy, free energy, partition function, Boltzmann distribution, canonical ensemble, microcanonical ensemble, phase transition, Ising model, mean field theory, renormalisation group, fluctuation theorem, Onsager reciprocal relations, non-equilibrium thermodynamics), quantum mechanics (wave function, Schrödinger equation, superposition, Born rule, entanglement, uncertainty principle, spin, angular momentum algebra, Hilbert space formalism, density matrix, path integral, perturbation theory, variational method, WKB approximation, quantum tunnelling, energy level), electromagnetism (electric field, magnetic field, Maxwell equations, electromagnetic wave, Lorentz force, gauge invariance, vector potential, polarisation, dielectric, magnetic material, waveguide, radiation), quantum field theory (field operator, vacuum state, normal ordering, Feynman diagram, propagator, S-matrix, regularisation, renormalisation, running coupling, gauge theory, Standard Model, spontaneous symmetry breaking, Higgs mechanism, confinement, anomaly), special and general relativity (spacetime interval, Lorentz transformation, four-vector, mass-energy equivalence, equivalence principle, Einstein field equations, geodesic equation, Schwarzschild solution, gravitational wave, black hole, Penrose diagram, cosmological constant), fluid dynamics (Navier-Stokes equations, Reynolds number, turbulence, viscosity, boundary layer, vorticity, potential flow, Bernoulli principle, compressible flow, shock wave, hydrodynamic instability), optics (geometric optics, ray tracing, wave optics, interference, diffraction, Snell law, Fresnel equations, polarisation, coherence, laser, nonlinear optics, quantum optics, photon), nuclear and particle physics (nuclear binding energy, radioactive decay, fission, fusion, quark model, lepton, gauge boson, fundamental interaction, Feynman rules, cross section, detector physics), chemistry foundations (atomic orbital, electron configuration, valence, covalent bond, ionic bond, hydrogen bond, electronegativity, reaction kinetics, activation energy, chemical equilibrium, Gibbs free energy, phase diagram, acid-base, electrochemistry, coordination chemistry, periodic trends), biochemistry (amino acid, protein structure, enzyme kinetics, metabolic pathway, glycolysis, citric acid cycle, oxidative phosphorylation, ATP synthesis, lipid bilayer, nucleotide, coenzyme, allosteric regulation)',
  },
  {
    tier: 5,
    name: 'Life Sciences & Mind',
    taglineHint: 'the principles governing living systems, heredity, evolution, neural function, and cognition',
    domain: 'Molecular biology and genetics (DNA double helix, base pairing, gene, codon, transcription, translation, mutation, replication, chromosome, gene regulation, operon, transcription factor, CRISPR, restriction enzyme, PCR, DNA sequencing, RNA splicing, non-coding RNA), genomics and bioinformatics (genome, SNP, GWAS, sequence alignment, BLAST, phylogenetic tree, protein structure prediction, proteomics, transcriptomics, metagenomics, population genetics, linkage disequilibrium, genetic association), epigenetics and developmental biology (DNA methylation, histone modification, chromatin remodeling, morphogenesis, cell differentiation, stem cell, totipotency, Hox gene, induction, positional information, organogenesis, pattern formation), cell biology (cell membrane, phospholipid bilayer, organelle, mitochondria, nucleus, endoplasmic reticulum, Golgi apparatus, cell cycle, mitosis, meiosis, signal transduction cascade, apoptosis, cytoskeleton, motor protein, vesicle trafficking, autophagy), evolutionary biology (natural selection, fitness landscape, genetic drift, gene flow, speciation, phylogeny, adaptation, sexual selection, kin selection, evolutionary stable strategy, common descent, molecular clock, neutral theory, multilevel selection, evolutionary developmental biology), immunology (innate immunity, adaptive immunity, T cell, B cell, antibody, antigen, MHC molecule, complement system, inflammation, cytokine, toll-like receptor, autoimmunity, vaccine mechanism, immunological memory, clonal selection), neuroscience (action potential, resting potential, synapse, neurotransmitter, receptor, long-term potentiation, ion channel, myelin, neural circuit, synaptic plasticity, blood-brain barrier, cortical organisation, oscillation, neural coding, connectome), cognitive science and psychology (perception, attention, working memory, long-term memory, executive function, learning, classical conditioning, operant conditioning, schema, cognitive bias, emotion, motivation, consciousness, embodied cognition, language acquisition, theory of mind), pharmacology (drug-receptor interaction, dose-response curve, pharmacokinetics, pharmacodynamics, agonist, antagonist, partial agonist, therapeutic index, drug metabolism, CYP enzymes, receptor desensitisation, blood-brain barrier penetration), linguistics (phoneme, morpheme, syntactic structure, semantics, pragmatics, grammar, universal grammar, language universals, Chomsky hierarchy, language evolution, pidgin and creole, psycholinguistics, computational linguistics), philosophy of mind (consciousness, qualia, hard problem, functionalism, physicalism, property dualism, intentionality, mental representation, free will, personal identity, extended mind)',
  },
  {
    tier: 6,
    name: 'Complex Systems & Social Sciences',
    taglineHint: 'emergence, self-organisation, Earth systems, collective human behaviour, and economic order',
    domain: 'Complex systems (emergence, self-organisation, feedback loop, attractor, strange attractor, chaos theory, Lyapunov exponent, bifurcation, power law, scale-free network, small-world network, percolation, cellular automaton, agent-based model, swarm intelligence, criticality, self-organised criticality), network science (centrality measures, community detection, network resilience, spreading processes, epidemic networks, multiplex network, temporal network, network formation, structural holes, motif), epidemiology (R₀, herd immunity, SIR model, compartmental model, transmission dynamics, case fatality rate, contact tracing, epidemic curve, incubation period, population attributable risk, confounding, selection bias, causal inference in observational studies), earth and climate sciences (plate tectonics, subduction, rock cycle, atmospheric circulation, jet stream, carbon cycle, ocean thermohaline circulation, greenhouse effect, climate sensitivity, radiative forcing, feedback, hydrological cycle, soil formation, geophysics, paleoclimatology, ice core record), ecology (food web, trophic level, ecosystem, ecological niche, carrying capacity, population dynamics, predator-prey cycle, biodiversity, succession, keystone species, nutrient cycle, island biogeography, metapopulation, ecosystem services, regime shift), economics (utility function, supply and demand, equilibrium, comparative advantage, externality, public good, game theory, Nash equilibrium, mechanism design, auction theory, information asymmetry, moral hazard, money supply, inflation, interest rate, growth theory, welfare economics, behavioral economics, prospect theory), decision theory (expected utility theory, prospect theory, risk aversion, ambiguity aversion, bounded rationality, heuristics and biases, intertemporal choice, social choice theory, Arrow impossibility), social science foundations (institution, social norm, social capital, collective action problem, power, social network, culture, inequality, rational choice, trust, legitimacy, Durkheim, Weber, collective behaviour, social identity, stratification, social mobility), philosophy of science (falsification, paradigm shift, scientific method, underdetermination, Bayesian confirmation, scientific realism, reduction and emergence, laws of nature, natural kinds, scientific explanation), ethics and moral philosophy (utilitarianism, deontology, virtue ethics, contractualism, moral intuition, metaethics, moral realism, applied ethics, population ethics, moral luck)',
  },
  {
    tier: 7,
    name: 'Applied & Frontier Concepts',
    taglineHint: 'knowledge deployed to build, compute, heal, explore, and engineer the world',
    domain: 'Machine learning and AI (gradient descent, backpropagation, convolutional network, recurrent network, attention mechanism, transformer, self-supervised learning, embedding, loss function, regularisation, reinforcement learning, Markov decision process, policy gradient, value function, generative adversarial network, diffusion model, large language model, in-context learning, alignment), quantum computing (qubit, quantum gate, quantum entanglement, quantum circuit, quantum error correction, surface code, Shor algorithm, Grover algorithm, quantum advantage, variational quantum eigensolver, quantum simulation, fault-tolerant computing), computer systems and theory (computer architecture, instruction set, cache hierarchy, operating system, distributed system, consensus protocol, Byzantine fault, database, relational algebra, transaction, network protocol, TCP/IP, cryptography, public-key encryption, zero-knowledge proof, hash function, blockchain), signal processing (Fourier transform, wavelet transform, sampling theorem, digital filter, Nyquist-Shannon theorem, spectral estimation, compressed sensing, inverse problem, matched filter), control theory (feedback control, PID controller, stability theory, Lyapunov stability, root locus, Bode plot, optimal control, LQR, model predictive control, robust control, observability, controllability, Kalman filter), robotics and autonomous systems (forward and inverse kinematics, rigid body dynamics, SLAM, motion planning, sensor fusion, manipulation, autonomous vehicle, human-robot interaction, reinforcement learning for control), medicine and physiology (homeostasis, immune response, inflammation, coagulation, pharmacokinetics, receptor signaling, cardiovascular physiology, endocrine system, cancer biology, clinical trial design, randomised controlled trial, precision medicine, gene therapy, immunotherapy), synthetic biology and biotechnology (genetic circuit, gene editing, metabolic engineering, directed evolution, biosensor, protein design, de novo protein, cell-free system, mRNA therapeutics, gene therapy vector, organoid), cosmology and astrophysics (Big Bang, cosmic microwave background, inflation, dark matter, dark energy, stellar evolution, stellar nucleosynthesis, galaxy formation, gravitational lensing, black hole merger, gravitational wave detection, Hubble tension, large-scale structure), materials science (crystal structure, band gap, conductor, semiconductor, insulator, polymer, phase diagram, dislocation, surface energy, superconductivity, topological insulator, 2D material, metamaterial, self-assembly, thin film deposition, perovskite), climate technology and sustainability (carbon capture, renewable energy, photovoltaics, energy storage, grid stability, geoengineering, life cycle assessment, circular economy, remote sensing, earth observation satellite)',
  },
];

function resolveApiKey() {
  return import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || '';
}

async function callTier(apiKey, spec, signal) {
  const prompt = `Generate tier ${spec.tier} of a 7-tier concept hierarchy of all scientific knowledge.

Tier ${spec.tier} of 7: "${spec.name}"
This tier covers: ${spec.domain}

RULES — output ONLY valid compact JSON, no preamble, no markdown fences:
- These are CONCEPTS (intellectual primitives), NOT fields: "Vector Space" ✓  "Linear Algebra" ✗
- 6–8 groups, 8–15 concepts per group
- tier field must be exactly ${spec.tier}

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
  if (!m) throw new Error(`Tier ${spec.tier}: no JSON in response (got: ${raw.slice(0, 100)})`);
  const parsed = JSON.parse(m[0]);
  // Always override tier number — don't trust Claude to get it right
  parsed.tier = spec.tier;
  parsed.name = spec.name;
  return parsed;
}

async function streamExplanation(concept, apiKey, signal, onChunk) {
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
      max_tokens: 500,
      stream: true,
      system: `You explain scientific concepts to complete beginners — people with no maths, no science, no jargon.
Use an everyday analogy first. Plain language only. Two to three short paragraphs.
End with a single sentence: "Why it matters: ..."`,
      messages: [{ role: 'user', content: `Explain "${concept}" to a complete beginner.` }],
    }),
    signal,
  });

  if (!res.ok) {
    let msg = `API error ${res.status}`;
    try { const err = await res.json(); msg = err.error?.message || msg; } catch {}
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const d = line.slice(6).trim();
        if (!d || d === '[DONE]') continue;
        try {
          const ev = JSON.parse(d);
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
            text += ev.delta.text;
            onChunk(text);
          }
        } catch {}
      }
    }
  } finally { reader.releaseLock(); }
  return text;
}

export default function ConceptTiersView({ onGenerate }) {
  const [data,      setData]      = useState(null);
  const [status,    setStatus]    = useState('idle');
  const [errorMsg,  setErrorMsg]  = useState('');
  const [explainer, setExplainer] = useState({ concept: '', text: '', status: 'idle' });
  const abortRef    = useRef(null);
  const explAbortRef = useRef(null);
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
    for (const spec of TIER_SPECS) {
      if (abortRef.current.signal.aborted) break;
      try {
        const tier = await callTier(apiKey, spec, abortRef.current.signal);
        tiers.push(tier);
        setData([...tiers]);
      } catch (e) {
        if (e.name === 'AbortError') break;
        // Push placeholder so tier numbering stays correct visually
        tiers.push({ tier: spec.tier, name: spec.name, tagline: 'Failed to generate — click Regenerate to retry.', groups: [] });
        setData([...tiers]);
      }
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(tiers));
    setStatus('done');
  }

  async function explain(concept) {
    const apiKey = resolveApiKey();
    if (!apiKey) return;
    explAbortRef.current?.abort();
    explAbortRef.current = new AbortController();
    setExplainer({ concept, text: '', status: 'loading' });
    try {
      await streamExplanation(concept, apiKey, explAbortRef.current.signal, text => {
        setExplainer(prev => ({ ...prev, text }));
      });
      setExplainer(prev => ({ ...prev, status: 'done' }));
    } catch (e) {
      if (e.name !== 'AbortError') setExplainer(prev => ({ ...prev, status: 'error' }));
    }
  }

  const totalConcepts = data
    ? data.reduce((s, t) => s + (t.groups?.reduce((ss, g) => ss + g.concepts.length, 0) ?? 0), 0)
    : 0;

  const generatingTierIdx = data?.length ?? 0;

  return (
    <div className="mt-8 space-y-6">
      {/* Header */}
      <div className="border-b border-stone-200 pb-4">
        <div className="flex items-baseline gap-3 mb-1">
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Concept Hierarchy of Science</h2>
          {(status === 'done' || (status === 'loading' && data?.length)) && (
            <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-stone-800 text-white">
              {totalConcepts} concepts · {data?.length ?? 0}/{TIER_SPECS.length} tiers
            </span>
          )}
        </div>
        <p className="text-sm text-stone-500 max-w-2xl">
          All fundamental scientific concepts ordered by generality — from pure abstraction to direct application.
          Click a concept for a reading path from zero · click <span className="font-mono">?</span> for a plain-English explanation.
        </p>
        {status === 'done' && (
          <button onClick={() => { localStorage.removeItem(CACHE_KEY); generate(); }}
            className="mt-2 text-[10px] font-mono text-stone-400 hover:text-stone-700 underline">
            Regenerate
          </button>
        )}
      </div>

      {/* Loading indicator (shown above tiers as they stream in) */}
      {status === 'loading' && (
        <div className="flex items-center gap-3 py-1">
          <span className="flex gap-0.5">
            <span className="loading-dot"/><span className="loading-dot"/><span className="loading-dot"/>
          </span>
          <span className="text-sm font-mono text-stone-500">
            Generating tier {generatingTierIdx + 1} of {TIER_SPECS.length} — {TIER_SPECS[generatingTierIdx]?.name}…
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
        const tierTotal = tier.groups?.reduce((s, g) => s + g.concepts.length, 0) ?? 0;
        return (
          <div key={tier.tier} className="border border-stone-200">
            <div className={`px-4 py-3 ${c.bg} text-white`}>
              <div className="flex items-baseline gap-3">
                <span className="text-[9px] font-mono font-bold opacity-60 tracking-widest">TIER {tier.tier}</span>
                <span className="font-bold text-sm">{tier.name}</span>
                <span className="text-[9px] font-mono opacity-50 ml-auto">{tierTotal} concepts</span>
              </div>
              <p className="text-[11px] opacity-75 mt-0.5 leading-snug">{tier.tagline}</p>
            </div>

            <div className="p-4 space-y-4 bg-white">
              {tier.groups?.map((group, gi) => (
                <div key={gi}>
                  <div className={`text-[9px] font-mono font-bold uppercase tracking-widest mb-2 ${c.text}`}>
                    {group.name}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.concepts.map((concept, ci) => {
                      const pathActive    = readingPath.topic === concept;
                      const explainActive = explainer.concept === concept;
                      return (
                        <span key={ci} className="group/chip inline-flex items-center gap-0">
                          <button
                            onClick={() => readingPath.generate(concept)}
                            className={`text-[11px] font-mono px-2 py-1 border transition-all ${
                              pathActive
                                ? c.active
                                : `bg-white text-stone-700 border-stone-200 ${c.hover}`
                            }`}
                          >
                            {concept}
                            {pathActive && (
                              <span className="ml-1 opacity-75 text-[9px]">
                                {readingPath.status === 'loading' ? '···' : '◆'}
                              </span>
                            )}
                          </button>
                          <button
                            onClick={() => explain(concept)}
                            title="Explain to a beginner"
                            className={`text-[9px] font-mono px-1 py-1 border-y border-r transition-all ${
                              explainActive
                                ? 'bg-stone-800 text-white border-stone-800'
                                : 'bg-stone-50 text-stone-400 border-stone-200 opacity-0 group-hover/chip:opacity-100 hover:bg-stone-800 hover:text-white hover:border-stone-800'
                            }`}
                          >
                            ?
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Explanation panel */}
      {explainer.status !== 'idle' && (
        <div className="border border-stone-200 bg-white">
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 bg-stone-50">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-stone-700">Explain</span>
              <span className="text-sm text-stone-500">{explainer.concept}</span>
              {explainer.status === 'loading' && (
                <span className="flex gap-0.5">
                  <span className="loading-dot"/><span className="loading-dot"/><span className="loading-dot"/>
                </span>
              )}
            </div>
            <button onClick={() => setExplainer({ concept: '', text: '', status: 'idle' })}
              className="text-[9px] font-mono text-stone-400 hover:text-stone-700 px-2 py-0.5 border border-stone-200 hover:border-stone-400 transition-colors">
              ✕ close
            </button>
          </div>
          <div className="p-4 text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">
            {explainer.text || (explainer.status === 'loading' ? '' : 'Error generating explanation.')}
          </div>
        </div>
      )}

      {/* Reading Path panel */}
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
