const COURSE_COLORS = [
  { bg: 'bg-sky-50',     border: 'border-sky-200',     badge: 'bg-sky-100 text-sky-700',         num: 'text-sky-400',     paperBg: 'bg-sky-100/60' },
  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  badge: 'bg-indigo-100 text-indigo-700',   num: 'text-indigo-400',  paperBg: 'bg-indigo-100/60' },
  { bg: 'bg-violet-50',  border: 'border-violet-200',  badge: 'bg-violet-100 text-violet-700',   num: 'text-violet-400',  paperBg: 'bg-violet-100/60' },
  { bg: 'bg-teal-50',    border: 'border-teal-200',    badge: 'bg-teal-100 text-teal-700',       num: 'text-teal-500',    paperBg: 'bg-teal-100/60' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', num: 'text-emerald-500', paperBg: 'bg-emerald-100/60' },
  { bg: 'bg-amber-50',   border: 'border-amber-200',   badge: 'bg-amber-100 text-amber-700',     num: 'text-amber-500',   paperBg: 'bg-amber-100/60' },
  { bg: 'bg-rose-50',    border: 'border-rose-200',    badge: 'bg-rose-100 text-rose-700',       num: 'text-rose-400',    paperBg: 'bg-rose-100/60' },
  { bg: 'bg-cyan-50',    border: 'border-cyan-200',    badge: 'bg-cyan-100 text-cyan-700',       num: 'text-cyan-500',    paperBg: 'bg-cyan-100/60' },
  { bg: 'bg-orange-50',  border: 'border-orange-200',  badge: 'bg-orange-100 text-orange-700',   num: 'text-orange-500',  paperBg: 'bg-orange-100/60' },
];

export default function CurriculumView({ parsed, isStreaming, ospCount, seminalCount }) {
  if (!parsed) return null;

  const hasContent = parsed.topic || parsed.courses.length > 0;
  if (!hasContent) {
    return (
      <div className="mt-10 flex items-center gap-2.5 text-stone-400">
        <span className="flex gap-0.5">
          <span className="loading-dot" />
          <span className="loading-dot" />
          <span className="loading-dot" />
        </span>
        <span className="text-sm">Building curriculum from syllabus data...</span>
      </div>
    );
  }

  return (
    <div className={`mt-10 ${isStreaming ? 'opacity-90' : ''}`}>

      {/* Header */}
      {parsed.topic && (
        <div className="mb-8">
          <p className="text-xs font-mono text-stone-400 mb-1">University Curriculum</p>
          <h2 className="text-xl font-semibold text-stone-900 tracking-tight leading-snug">{parsed.topic}</h2>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
            {parsed.levelRange && <span className="text-xs text-stone-500">{parsed.levelRange}</span>}
            {(ospCount > 0 || seminalCount > 0) && (
              <>
                <span className="text-stone-300 text-xs">·</span>
                <span className="text-xs text-stone-400">
                  {[
                    ospCount > 0 && `${ospCount} syllabus works`,
                    seminalCount > 0 && `${seminalCount} seminal papers`,
                  ].filter(Boolean).join(' · ')}
                </span>
              </>
            )}
          </div>

          {/* Tracks */}
          {parsed.tracks.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5 items-center">
              <span className="text-xs font-mono text-stone-400 mr-1">Tracks</span>
              {parsed.tracks.map((track, i) => (
                <span key={i} className="text-xs font-mono px-2 py-0.5 bg-stone-100 text-stone-600 border border-stone-200">
                  {track}
                </span>
              ))}
            </div>
          )}

          {parsed.overview && (
            <p className="mt-3 text-sm text-stone-600 leading-relaxed max-w-2xl">{parsed.overview}</p>
          )}
          <div className="mt-5 h-px bg-stone-200" />
        </div>
      )}

      {/* Courses */}
      <div className="space-y-4">
        {parsed.courses.map((course, i) => {
          const c = COURSE_COLORS[i % COURSE_COLORS.length];
          const showPrereqs = course.prereqs && course.prereqs.toLowerCase() !== 'none';
          const hasMetaPanel = course.skills.length > 0 || course.milestone;
          const hasTextbooks = course.textbooks.length > 0;
          const hasPapers = course.papers.length > 0;

          return (
            <div key={i} className={`border ${c.border} ${c.bg}`}>

              {/* Course header */}
              <div className="px-6 pt-5 pb-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`text-xs font-mono px-1.5 py-0.5 shrink-0 ${c.badge}`}>
                    Course {course.number}
                  </span>
                  {course.level && (
                    <span className={`text-xs font-mono px-1.5 py-0.5 shrink-0 ${c.badge} opacity-70`}>
                      {course.level}
                    </span>
                  )}
                  {course.duration && (
                    <span className="text-xs font-mono px-1.5 py-0.5 text-stone-500 bg-white/70 border border-stone-200">
                      {course.duration}
                    </span>
                  )}
                  {showPrereqs && (
                    <span className="text-xs text-stone-400 ml-1">
                      Requires: {course.prereqs}
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-stone-800">{course.name}</h3>
                {course.description && (
                  <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">{course.description}</p>
                )}
              </div>

              {/* Skills + Milestone */}
              {hasMetaPanel && (
                <div className="px-6 py-3 border-t border-b border-current/10 space-y-2.5 bg-white/40">
                  {course.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className="text-xs font-mono text-stone-400 shrink-0 w-14">Skills</span>
                      <div className="flex flex-wrap gap-1.5">
                        {course.skills.map((s, k) => (
                          <span key={k} className={`text-xs px-2 py-0.5 ${c.badge} opacity-80`}>{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {course.milestone && (
                    <div className="flex gap-2 items-start">
                      <span className="text-xs font-mono text-stone-400 shrink-0 w-14">After →</span>
                      <span className="text-xs text-stone-600 italic leading-relaxed">{course.milestone}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Textbooks */}
              {hasTextbooks && (
                <div className="px-6 py-4">
                  <p className="text-xs font-mono text-stone-400 mb-3">Textbooks</p>
                  <div className="space-y-4">
                    {course.textbooks.map((work, j) => (
                      <div key={j} className="flex gap-3">
                        <span className={`text-xs font-mono mt-0.5 shrink-0 w-4 ${c.num}`}>{j + 1}.</span>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="text-sm font-medium text-stone-800">{work.ref}</span>
                            {work.syllabusCount != null && (
                              <span className="text-xs font-mono text-stone-400 bg-white/70 px-1.5 py-0.5 border border-stone-100">
                                {work.syllabusCount.toLocaleString()} courses
                              </span>
                            )}
                            {work.role && (
                              <span className="text-xs text-stone-400 italic">{work.role}</span>
                            )}
                          </div>
                          {work.focus && (
                            <div className="mt-1.5 flex gap-1.5 items-start">
                              <span className="text-xs font-mono text-stone-400 shrink-0">→</span>
                              <span className="text-xs text-stone-600 leading-relaxed">{work.focus}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Seminal Papers */}
              {hasPapers && (
                <div className={`px-6 py-4 border-t border-current/10 ${c.paperBg}`}>
                  <p className="text-xs font-mono text-stone-400 mb-3">Seminal Papers</p>
                  <div className="space-y-3">
                    {course.papers.map((paper, j) => (
                      <div key={j} className="flex gap-2 items-start">
                        <span className="text-xs font-mono text-stone-300 shrink-0 mt-0.5">—</span>
                        <div className="flex-1">
                          <span className="text-sm text-stone-700 italic">{paper.ref}</span>
                          {paper.rationale && (
                            <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{paper.rationale}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          );
        })}
      </div>

      {/* Total curriculum footer */}
      {parsed.totalCurriculum && (
        <div className="mt-6 flex items-baseline gap-3 px-5 py-4 bg-stone-900">
          <span className="text-xs font-mono text-stone-400 shrink-0">Total Curriculum</span>
          <span className="text-sm text-stone-200">{parsed.totalCurriculum}</span>
        </div>
      )}

    </div>
  );
}
