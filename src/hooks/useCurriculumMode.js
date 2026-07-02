import { useState, useCallback, useRef, useMemo } from 'react';
import { syllabusHarvest, seminalPapersHarvest } from '../utils/syllabusHarvest';
import { parseCurriculum } from '../utils/parseCurriculum';

function resolveApiKey() {
  return import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || '';
}

const SYSTEM_PROMPT = `You are a senior university curriculum designer. You have data from the Open Syllabus Project (textbooks most assigned worldwide) and Semantic Scholar (most influential research papers). Build the definitive university curriculum for the requested topic.

CRITICAL: Output ONLY the structured text below. No markdown. No bold. No headers with #. No preamble. No explanation. Start your response with "TOPIC:" and nothing before it.

TOPIC: [topic name]
OVERVIEW: [the intellectual structure of the field, major subfields, and what mastery looks like]
LEVEL RANGE: [e.g., First-year undergraduate to active researcher]
TRACKS: [comma-separated tracks if meaningful, e.g. Theoretical, Applied, Computational — omit line entirely if not applicable]

---

COURSE 1: [Course title]
LEVEL: [Undergraduate Year 1-2 / Undergraduate Year 3-4 / Graduate Year 1-2 / Advanced Graduate / Research Seminar]
DURATION: [e.g., 1 semester]
PREREQS: [prior course numbers e.g. "Course 1, Course 2", or "None"]
SKILLS: [3-5 specific competencies, comma-separated, e.g. "Can implement gradient descent, Can prove convergence theorems, Can read Bishop Ch.1-3"]
MILESTONE: [One sentence naming a specific paper or capability unlocked after this course]
[One sentence describing what this course covers and prepares students for]
TEXTBOOKS:
- [Title] by [Author] ([Year]) -- [N] university courses -- [core text / supplementary / reference]
  -> Typically covers: [chapters or topics]
PAPERS:
- [Title] by [Author] ([Year]) -- [why essential at this stage]

COURSE 2: [Title]
LEVEL: ...
[repeat structure]

---

TOTAL CURRICULUM: [N courses * X-Y years from beginner to research frontier]

Rules:
- Use ONLY titles from the supplied data lists
- As many courses as the subject genuinely requires, strictly introductory to advanced
- Include as many TEXTBOOKS and PAPERS per course as genuinely belong there; omit PAPERS section entirely if none fit
- PREREQS must reference course numbers (e.g. "Course 1") not descriptions
- SKILLS must be specific and measurable abilities, not vague understanding
- Honor syllabusCount: 1000+ = Year 1-2, 100-999 = Year 3-4/early grad, 10-99 = graduate, <10 = seminar
- Never repeat a work across courses
- TOTAL CURRICULUM line is mandatory
- Do not use dashes (---) to separate courses, only use --- before COURSE 1 and at the end`;

export function useCurriculumMode() {
  const [phase, setPhase] = useState('idle'); // idle | harvesting | generating | complete | error
  const [topic, setTopic] = useState('');
  const [content, setContent] = useState('');
  const [ospWorks, setOspWorks] = useState([]);
  const [seminalWorks, setSeminalWorks] = useState([]);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const generate = useCallback(async (inputTopic) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setTopic(inputTopic);
    setContent('');
    setOspWorks([]);
    setSeminalWorks([]);
    setError(null);
    setPhase('harvesting');

    const apiKey = resolveApiKey();
    if (!apiKey) {
      setError('No API key set. Enter your Anthropic API key above.');
      setPhase('error');
      return;
    }

    let works = [];
    let papers = [];
    try {
      [works, papers] = await Promise.all([
        syllabusHarvest(inputTopic),
        seminalPapersHarvest(inputTopic),
      ]);
      if (signal.aborted) return;
      setOspWorks(works);
      setSeminalWorks(papers);
    } catch {
      works = [];
      papers = [];
    }

    if (signal.aborted) return;
    setPhase('generating');

    const ospData = works.length > 0
      ? works.slice(0, 70).map(w =>
          `- ${w.title}${w.authors ? ` by ${w.authors}` : ''}${w.year ? ` (${w.year})` : ''} — ${w.syllabusCount || 0} university courses`
        ).join('\n')
      : '(No Open Syllabus data available — use your knowledge of standard university curricula for this topic)';

    const seminalData = papers.length > 0
      ? papers.slice(0, 40).map(p =>
          `- "${p.title}"${p.authors ? ` by ${p.authors}` : ''}${p.year ? ` (${p.year})` : ''} — ${p.influentialCitationCount.toLocaleString()} influential citations`
        ).join('\n')
      : '(No Semantic Scholar data available)';

    const userMessage = `Build the complete university curriculum for: ${inputTopic}

=== TEXTBOOKS (Open Syllabus Project, ranked by worldwide university course assignments) ===
${ospData}

=== FOUNDATIONAL PAPERS (Semantic Scholar, ranked by influential citations) ===
${seminalData}

Use only works from the lists above. Place OSP works in TEXTBOOKS sections and Semantic Scholar works in PAPERS sections.`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-5',
          max_tokens: 6000,
          stream: true,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage }],
        }),
        signal,
      });

      if (!response.ok) {
        let msg = `API error ${response.status}`;
        try { const err = await response.json(); msg = err.error?.message || msg; } catch {}
        throw new Error(msg);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let result = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (!data || data === '[DONE]') continue;
            try {
              const event = JSON.parse(data);
              if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                result += event.delta.text;
                setContent(result);
              }
            } catch {}
          }
        }
      } finally {
        reader.releaseLock();
      }

      if (!signal.aborted) setPhase('complete');
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Generation failed. Please try again.');
        setPhase('error');
      } else {
        setPhase('idle');
      }
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setPhase('idle');
    setContent('');
    setTopic('');
    setOspWorks([]);
    setSeminalWorks([]);
    setError(null);
  }, []);

  const parsed = useMemo(() => parseCurriculum(content), [content]);

  return { phase, topic, content, ospWorks, seminalWorks, error, parsed, generate, reset };
}
