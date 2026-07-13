import { useState } from 'react';
// Opens when an entity (work / concept / author) is clicked in the
// Knowledge Browser. Shows what it's connected to.

function Citation({ n }) {
  if (n == null) return null;
  return <span className="text-xs text-stone-500 font-mono">{n.toLocaleString()} citations</span>;
}

function WorkCard({ w, onClick, small }) {
  if (!w) return null;
  return (
    <button
      onClick={() => onClick({ type: 'work', name: w.title, work: w })}
      className={`w-full text-left ${small ? 'p-2' : 'p-3'} bg-white border border-stone-200 hover:border-stone-400 hover:bg-stone-50 transition-colors block`}
    >
      <div className="text-sm font-medium text-stone-800 line-clamp-2">{w.title}</div>
      <div className="text-xs text-stone-500 mt-0.5">
        {w.authors?.split(',')[0]}{w.year ? ` · ${w.year}` : ''}
      </div>
      {!small && (
        <div className="flex gap-2 mt-1.5">
          <Citation n={w.citationCount} />
          {w.fwci != null && <span className="text-xs text-stone-500">FWCI {w.fwci.toFixed(2)}</span>}
          {w.isOA && w.oaUrl && (
            <a href={w.oaUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-600 hover:underline">OA</a>
          )}
        </div>
      )}
    </button>
  );
}

function PersonCard({ name, profile, onClick, small }) {
  return (
    <button
      onClick={() => onClick({ type: 'author', name, profile })}
      className={`w-full text-left ${small ? 'p-2' : 'p-3'} bg-white border border-stone-200 hover:border-stone-400 hover:bg-stone-50 transition-colors`}
    >
      <div className="text-sm font-medium text-stone-800">{name}</div>
      {profile && (
        <div className="text-xs text-stone-500 mt-0.5">
          {profile.works.length} works · {profile.totalCitations.toLocaleString()} total citations
          {profile.firstYear && profile.lastYear && ` · ${profile.firstYear}–${profile.lastYear}`}
        </div>
      )}
    </button>
  );
}

function ConceptCard({ name, definition, tier, canonicalWorks, onClick }) {
  return (
    <button
      onClick={() => onClick({ type: 'concept', name, definition, tier, canonicalWorks })}
      className="w-full text-left p-2.5 bg-white border border-stone-200 hover:border-stone-400 hover:bg-stone-50 transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono px-1.5 py-0.5 bg-violet-100 text-violet-700">
          {tier ? `T${tier}` : 'concept'}
        </span>
        <span className="text-sm font-medium text-stone-800">{name}</span>
      </div>
      {definition && (
        <div className="text-xs text-stone-500 mt-1 line-clamp-2">{definition}</div>
      )}
    </button>
  );
}
function ConceptPanel({ entity, index, onOpen }) {
  const [showHarvested, setShowHarvested] = useState(false);
  const canonicalWorks = entity.canonicalWorks || [];
  const allScored = index.conceptToWorks.get(entity.name) || [];
  // Harvested works that OA-tagged as this concept (score >= 1), excluding any already in canonical list
  const canonTitlesLc = new Set(canonicalWorks.map(w => w.title.toLowerCase().trim()));
  const harvested = allScored
    .filter(s => s.score >= 1)
    .filter(s => !canonTitlesLc.has((s.work.matchedWork?.title || s.work.title || '').toLowerCase().trim()))
    .sort((a, b) => b.score - a.score);
  const inBackground = allScored.filter(s => s.score === 0);

  return (
    <div className="space-y-5">
      {entity.definition && (
        <div>
          <div className="text-xs font-mono text-stone-400 mb-1">DEFINITION</div>
          <p className="text-sm text-stone-700">{entity.definition}</p>
        </div>
      )}

      {entity.tier && (
        <div>
          <div className="text-xs font-mono text-stone-400 mb-1">TIER</div>
          <p className="text-sm text-stone-700">
            {entity.tier === '1' ? 'Prerequisite — required before engaging' :
             entity.tier === '2' ? 'Core — central to the field' :
             entity.tier === '3' ? 'Advanced — research frontier' :
             'Concept in this field'}
          </p>
        </div>
      )}

      {/* Claude's canonical works — always shown when present */}
      {canonicalWorks.length > 0 && (
        <Section title="Key works" count={canonicalWorks.length}>
          <div className="space-y-1.5">
            {canonicalWorks.map(cw => {
              // Try to find a matching harvested work with full metadata
              const scored = allScored.find(s => {
                const t = (s.work.matchedWork?.title || s.work.title || '').toLowerCase();
                return t.includes(cw.title.toLowerCase()) || cw.title.toLowerCase().includes(t.slice(0, 20));
              });
              const hw = scored?.work.matchedWork || scored?.work;
              return (
                <div key={cw.title} className="flex items-start gap-2">
                  <span className="shrink-0 mt-2 text-[10px] font-mono px-1 py-0.5 bg-indigo-100 text-indigo-700">
                    key
                  </span>
                  {hw ? (
                    <button
                      onClick={() => onOpen({ type: 'work', name: hw.title, work: hw })}
                      className="min-w-0 flex-1 text-left p-2 bg-white border border-stone-200 hover:border-stone-400 hover:bg-stone-50 transition-colors"
                    >
                      <div className="text-sm font-medium text-stone-800 line-clamp-2">{hw.title}</div>
                      <div className="flex flex-wrap gap-x-3 text-xs text-stone-500 mt-0.5">
                        <span>{(hw.authors || '').split(',')[0]}{hw.year ? ` · ${hw.year}` : ''}</span>
                        {hw.citationCount > 0 && <span>{hw.citationCount.toLocaleString()} citations</span>}
                        {hw.fwci != null && <span>FWCI {hw.fwci.toFixed(2)}</span>}
                      </div>
                      {hw.isOA && hw.oaUrl && (
                        <span className="text-[10px] text-emerald-600 mt-0.5 block">Open Access</span>
                      )}
                    </button>
                  ) : (
                    <div className="min-w-0 flex-1 p-2 bg-stone-50 border border-stone-200">
                      <div className="text-sm font-medium text-stone-800 line-clamp-2">{cw.title}</div>
                      <div className="text-xs text-stone-500 mt-0.5">{cw.author}{cw.year ? ` · ${cw.year}` : ''}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Harvested works with OA concept tag match */}
      {harvested.length > 0 && (
        <div>
          <button
            onClick={() => setShowHarvested(s => !s)}
            className="w-full px-4 py-2.5 text-sm border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 transition-colors flex items-center justify-between"
          >
            <span className="font-medium">
              {showHarvested ? 'Hide' : 'Show'} {harvested.length} related harvested work{harvested.length !== 1 ? 's' : ''}
            </span>
            <span className="text-xs font-mono text-stone-500">{showHarvested ? '▲' : '▾'}</span>
          </button>
          {showHarvested && (
            <div className="mt-2 border border-stone-200 bg-stone-50 max-h-72 overflow-y-auto">
              <div className="divide-y divide-stone-100">
                {harvested.map(({ work, score }) => {
                  const w = work.matchedWork || work;
                  const authors = w.authors || w.allAuthors || '';
                  return (
                    <button
                      key={work.title}
                      onClick={() => onOpen({ type: 'work', name: w.title, work: w })}
                      className="w-full text-left px-3 py-2 bg-white hover:bg-stone-50 transition-colors"
                    >
                      <div className="flex items-start gap-1.5">
                        <span className={`shrink-0 mt-0.5 text-[9px] font-mono px-1 py-0.5 ${
                          score === 2 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>{score === 2 ? 'match' : 'related'}</span>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-stone-800 line-clamp-1">{w.title}</div>
                          <div className="flex gap-3 text-[10px] text-stone-500 mt-0.5">
                            <span>{authors.split(',')[0]}{w.year ? ` · ${w.year}` : ''}</span>
                            {w.citationCount > 0 && <span>{w.citationCount.toLocaleString()} cit.</span>}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {canonicalWorks.length === 0 && allScored.length === 0 && (
        <div className="text-xs text-stone-400 font-mono">
          No works linked to this concept yet.
        </div>
      )}
    </div>
  );
}


export default function EntityDetailPanel({ entity, index, onClose, onOpen }) {
  if (!entity) return null;

  const { type } = entity;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <aside className="fixed top-0 right-0 h-screen w-full max-w-xl bg-white shadow-2xl z-50 overflow-y-auto border-l border-stone-200">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-6 pb-4 border-b border-stone-200">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-mono px-2 py-0.5 ${
                  type === 'work' ? 'bg-emerald-100 text-emerald-700' :
                  type === 'author' ? 'bg-indigo-100 text-indigo-700' :
                  type === 'concept' ? 'bg-violet-100 text-violet-700' :
                  'bg-stone-100 text-stone-700'
                }`}>
                  {type === 'work' ? 'WORK' : type === 'author' ? 'RESEARCHER' : type === 'concept' ? 'CONCEPT' : type.toUpperCase()}
                </span>
              </div>
              <h2 className="text-xl font-bold text-stone-900 break-words">
                {entity.name}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
              </svg>
            </button>
          </div>

          {/* Work */}
          {type === 'work' && entity.work && (
            <div className="space-y-5">
              <div>
                <div className="text-sm text-stone-600 mb-1">
                  {entity.work.authors}
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-stone-500">
                  {entity.work.year && <span>Year: {entity.work.year}</span>}
                  {entity.work.venue && <span>Venue: {entity.work.venue}</span>}
                  <Citation n={entity.work.citationCount} />
                  {entity.work.fwci != null && <span>FWCI: {entity.work.fwci.toFixed(2)}</span>}
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {entity.work.doi && (
                    <a href={`https://doi.org/${entity.work.doi}`} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 border border-stone-300 text-stone-700 hover:bg-stone-50">
                      DOI ↗
                    </a>
                  )}
                  {entity.work.isOA && entity.work.oaUrl && (
                    <a href={entity.work.oaUrl} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 border border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                      Open Access ↗
                    </a>
                  )}
                  <a href={`https://scholar.google.com/scholar?q=${encodeURIComponent('"' + entity.work.title + '"')}`} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 border border-stone-300 text-stone-700 hover:bg-stone-50">
                    Google Scholar ↗
                  </a>
                </div>
              </div>

              {/* Concepts this work touches */}
              {index.workToConcepts.get(entity.name)?.size > 0 && (
                <Section title="Concepts in this work" count={index.workToConcepts.get(entity.name).size}>
                  <div className="space-y-1.5">
                    {Array.from(index.workToConcepts.get(entity.name)).map(cName => {
                      const c = (entity._parsedConcepts || []).find(x => x.name === cName);
                      return (
                        <ConceptCard
                          key={cName}
                          name={cName}
                          definition={c?.definition}
                          tier={c?.tier}
                          canonicalWorks={c?.canonicalWorks}
                          onClick={onOpen}
                        />
                      );
                    })}
                  </div>
                </Section>
              )}

              {/* Authors */}
              <Section title="Authors" count={index.workToAuthors.get(entity.name)?.length || 0}>
                <div className="space-y-1.5">
                  {(index.workToAuthors.get(entity.name) || []).map(a => {
                    const profile = index.authorProfile.get(a.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' '));
                    return (
                      <PersonCard
                        key={a}
                        name={a}
                        profile={profile}
                        onClick={onOpen}
                        small
                      />
                    );
                  })}
                </div>
              </Section>

              {/* Adjacent works (share an author) */}
              {(index.workToAdjacentWorks.get(entity.name) || []).length > 0 && (
                <Section title="Related works (shared authors)" count={index.workToAdjacentWorks.get(entity.name).length}>
                  <div className="space-y-1.5">
                    {index.workToAdjacentWorks.get(entity.name).map(w => (
                      <WorkCard key={w.title} w={w} onClick={onOpen} small />
                    ))}
                  </div>
                </Section>
              )}
            </div>
          )}

          {/* Author / Researcher */}
          {type === 'author' && (
            <div className="space-y-5">
              {entity.profile && (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Stat label="Works" value={entity.profile.works.length} />
                  <Stat label="Total citations" value={entity.profile.totalCitations.toLocaleString()} />
                  {entity.profile.firstYear && (
                    <Stat label="Active" value={`${entity.profile.firstYear}–${entity.profile.lastYear}`} />
                  )}
                </div>
              )}
              {entity.contribution && (
                <div>
                  <div className="text-xs font-mono text-stone-400 mb-1">CONTRIBUTION</div>
                  <p className="text-sm text-stone-700">{entity.contribution}</p>
                </div>
              )}

              {entity.profile && entity.profile.works.length > 0 && (
                <Section title="Works in this canon" count={entity.profile.works.length}>
                  <div className="space-y-1.5">
                    {entity.profile.works.map(w => (
                      <WorkCard key={w.title} w={w} onClick={onOpen} small />
                    ))}
                  </div>
                </Section>
              )}
            </div>
          )}

          {/* Concept */}
          {type === 'concept' && (
            <ConceptPanel
              entity={entity}
              index={index}
              onOpen={onOpen}
            />
          )}
        </div>
      </aside>
    </>
  );
}

function Section({ title, count, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-xs font-mono text-stone-400">{title}</h3>
        <span className="text-xs text-stone-400 font-mono">{count}</span>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-stone-50 border border-stone-200 px-3 py-2.5">
      <div className="text-xs font-mono text-stone-400">{label}</div>
      <div className="text-lg font-semibold text-stone-900 mt-0.5">{value}</div>
    </div>
  );
}
