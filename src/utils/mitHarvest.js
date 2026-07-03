const CACHE_KEY = 'mit_courses_v3';
const CACHE_TTL = 24 * 60 * 60 * 1000;

function loadFromCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function saveToCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

// MIT course-number prefix → broad field + department name fallback
const PREFIX_MAP = {
  '1':   { field: 'Engineering',    dept: 'Civil & Environmental Engineering' },
  '2':   { field: 'Engineering',    dept: 'Mechanical Engineering' },
  '3':   { field: 'Engineering',    dept: 'Materials Science & Engineering' },
  '4':   { field: 'Architecture',   dept: 'Architecture' },
  '5':   { field: 'Science',        dept: 'Chemistry' },
  '6':   { field: 'Engineering',    dept: 'Electrical Engineering & Computer Science' },
  '7':   { field: 'Science',        dept: 'Biology' },
  '8':   { field: 'Science',        dept: 'Physics' },
  '9':   { field: 'Science',        dept: 'Brain & Cognitive Sciences' },
  '10':  { field: 'Engineering',    dept: 'Chemical Engineering' },
  '11':  { field: 'Social Science', dept: 'Urban Studies & Planning' },
  '12':  { field: 'Science',        dept: 'Earth, Atmospheric & Planetary Sciences' },
  '14':  { field: 'Social Science', dept: 'Economics' },
  '15':  { field: 'Management',     dept: 'Sloan School of Management' },
  '16':  { field: 'Engineering',    dept: 'Aeronautics & Astronautics' },
  '17':  { field: 'Social Science', dept: 'Political Science' },
  '18':  { field: 'Mathematics',    dept: 'Mathematics' },
  '20':  { field: 'Engineering',    dept: 'Biological Engineering' },
  '21':  { field: 'Humanities',     dept: 'Humanities' },
  '21A': { field: 'Social Science', dept: 'Anthropology' },
  '21G': { field: 'Humanities',     dept: 'Global Languages' },
  '21H': { field: 'Humanities',     dept: 'History' },
  '21L': { field: 'Humanities',     dept: 'Literature' },
  '21M': { field: 'Humanities',     dept: 'Music & Theater Arts' },
  '22':  { field: 'Engineering',    dept: 'Nuclear Science & Engineering' },
  '24':  { field: 'Humanities',     dept: 'Linguistics & Philosophy' },
  'CMS': { field: 'Humanities',     dept: 'Comparative Media Studies' },
  'HST': { field: 'Science',        dept: 'Health Sciences & Technology' },
  'IDS': { field: 'Engineering',    dept: 'Data, Systems & Society' },
  'MAS': { field: 'Architecture',   dept: 'Media Arts & Sciences' },
  'STS': { field: 'Social Science', dept: 'Science, Technology & Society' },
  'WGS': { field: 'Social Science', dept: "Women's & Gender Studies" },
  'EC':  { field: 'Engineering',    dept: 'Edgerton Center' },
  'ES':  { field: 'Engineering',    dept: 'Experimental Study Group' },
};

// Title keyword → specialization label
const SPEC_KEYWORDS = [
  // CS & Engineering
  ['Machine Learning & AI',       ['machine learning', 'deep learning', 'neural network', 'artificial intelligence', 'reinforcement learning', 'natural language', 'large language', 'generative model']],
  ['Algorithms & Complexity',     ['algorithm', 'data structure', 'complexity theory', 'automata', 'computability', 'combinatorial optimization', 'computational geometry']],
  ['Systems & Architecture',      ['operating system', 'computer architecture', 'microprocessor', 'distributed system', 'parallel computing', 'cloud computing', 'embedded system', 'multicore']],
  ['Networks & Security',         ['computer network', 'network security', 'cryptography', 'internet', 'protocol', 'wireless', 'cybersecurity', 'privacy']],
  ['Software Engineering',        ['software engineering', 'software design', 'object-oriented', 'programming language', 'compiler', 'program analysis']],
  ['Data Science & Databases',    ['data science', 'database', 'data mining', 'information retrieval', 'big data', 'data management']],
  ['Computer Graphics & Vision',  ['computer graphics', 'computer vision', 'visualization', 'image processing', 'rendering', 'computational photography']],
  ['Robotics & Control',          ['robotics', 'autonomous', 'control system', 'mechatronics', 'feedback control', 'motion planning']],
  ['Signal Processing',           ['signal processing', 'digital signal', 'speech recognition', 'audio processing', 'radar']],
  ['Human-Computer Interaction',  ['human-computer interaction', 'user interface', 'usability', 'interaction design', 'ux design']],
  ['Theory of Computation',       ['theory of computation', 'formal language', 'information theory', 'coding theory', 'complexity']],
  ['Biomedical Engineering',      ['biomedical', 'biomechanics', 'medical device', 'tissue engineering', 'bioinformatics', 'bioengineering']],
  // Mathematics
  ['Calculus & Differential Equations', ['calculus', 'differential equation', 'ordinary differential', 'partial differential', 'numerical method']],
  ['Linear Algebra',              ['linear algebra', 'matrix algebra', 'vector space', 'eigenvalue']],
  ['Probability & Statistics',    ['probability', 'statistics', 'stochastic', 'random process', 'bayesian', 'inference']],
  ['Discrete Mathematics',        ['discrete math', 'combinatorics', 'number theory', 'enumerative combinatorics']],
  ['Mathematical Analysis',       ['real analysis', 'complex analysis', 'functional analysis', 'measure theory', 'mathematical analysis']],
  ['Abstract Algebra & Topology', ['abstract algebra', 'group theory', 'topology', 'differential geometry', 'algebraic geometry', 'algebraic topology']],
  ['Optimization',                ['optimization', 'convex optimization', 'linear programming', 'operations research', 'integer programming']],
  // Physics
  ['Quantum Mechanics',           ['quantum mechanic', 'quantum physic', 'quantum field', 'quantum information', 'quantum computing', 'quantum optic']],
  ['Classical Mechanics',         ['classical mechanic', 'lagrangian', 'hamiltonian', 'newtonian mechanic', 'rigid body']],
  ['Electromagnetism',            ['electromagnetism', 'electromagnetic', 'maxwell', 'electric field', 'magnetic field']],
  ['Thermodynamics & Stat Mech',  ['thermodynamic', 'statistical mechanic', 'heat transfer', 'thermal physics', 'entropy', 'statistical physics']],
  ['Astrophysics & Cosmology',    ['astrophysic', 'cosmology', 'astronomy', 'galaxy', 'stellar', 'universe', 'planetary', 'exoplanet']],
  ['Optics & Photonics',          ['optic', 'laser', 'photon', 'photonic', 'spectroscopy', 'nonlinear optic']],
  ['Condensed Matter Physics',    ['condensed matter', 'solid state physics', 'semiconductor', 'superconductor', 'nanophysics']],
  ['Nuclear & Particle Physics',  ['nuclear physics', 'particle physics', 'high energy', 'accelerator', 'detector']],
  // Chemistry
  ['Organic Chemistry',           ['organic chemistry', 'organic synthesis', 'organic compound', 'medicinal chemistry']],
  ['Physical Chemistry',          ['physical chemistry', 'chemical kinetics', 'thermochemistry', 'quantum chemistry']],
  ['Biochemistry',                ['biochemistry', 'molecular biology', 'protein', 'enzyme', 'metabolism', 'biomolecule']],
  ['Chemical Engineering Processes', ['chemical process', 'reaction engineering', 'mass transfer', 'separation process', 'chemical reactor']],
  // Biology
  ['Genetics & Genomics',         ['genetics', 'genomics', 'gene expression', 'dna', 'rna', 'epigenetics', 'genome']],
  ['Cell Biology',                ['cell biology', 'cell signaling', 'cellular mechanism', 'molecular cell']],
  ['Neuroscience',                ['neuroscience', 'neurology', 'brain', 'neural circuit', 'cognitive neuroscience', 'neural']],
  ['Ecology & Evolution',         ['ecology', 'evolution', 'ecosystem', 'biodiversity', 'population biology', 'evolutionary']],
  ['Systems Biology',             ['systems biology', 'network biology', 'computational biology', 'synthetic biology']],
  // Economics
  ['Microeconomics',              ['microeconomic', 'market design', 'industrial organization', 'consumer theory', 'pricing']],
  ['Macroeconomics',              ['macroeconomic', 'fiscal policy', 'monetary policy', 'business cycle', 'gdp']],
  ['Finance',                     ['finance', 'financial market', 'investment', 'portfolio', 'asset pricing', 'derivatives', 'risk management']],
  ['Econometrics',                ['econometric', 'causal inference', 'empirical method', 'regression analysis']],
  ['Game Theory',                 ['game theory', 'mechanism design', 'auction', 'strategic behavior']],
  ['Development Economics',       ['development economics', 'poverty', 'inequality', 'economic growth', 'international trade']],
  // Humanities
  ['History',                     ['history of', 'historical', 'ancient world', 'medieval', 'revolution', 'civilization', 'empire']],
  ['Literature & Writing',        ['literature', 'writing', 'poetry', 'fiction', 'prose', 'rhetoric', 'creative writing']],
  ['Philosophy & Ethics',         ['philosophy', 'ethics', 'epistemology', 'metaphysics', 'moral philosophy', 'political philosophy']],
  ['Linguistics',                 ['linguistics', 'phonology', 'syntax', 'semantics', 'pragmatics', 'language acquisition']],
  ['Music & Performing Arts',     ['music theory', 'composition', 'harmony', 'orchestration', 'theater', 'performance']],
  // Social Sciences
  ['Political Science',           ['political science', 'government', 'democracy', 'policy', 'international relations', 'geopolitics']],
  ['Sociology & Anthropology',    ['sociology', 'anthropology', 'social structure', 'culture', 'ethnography', 'urban sociology']],
  ['Urban Studies & Planning',    ['urban', 'city planning', 'transportation planning', 'housing', 'land use', 'urban design']],
  ['Psychology & Cognitive Science', ['psychology', 'cognitive science', 'cognition', 'perception', 'decision making', 'behavioral']],
  // Engineering subfields
  ['Fluid Mechanics',             ['fluid mechanics', 'fluid dynamics', 'aerodynamics', 'hydraulics', 'turbulence', 'hydrodynamics']],
  ['Structural Engineering',      ['structural', 'concrete design', 'steel design', 'seismic', 'bridge', 'foundation']],
  ['Materials Science',           ['materials science', 'material properties', 'polymer', 'composite', 'nanomaterial', 'alloy']],
  ['Energy Systems',              ['energy system', 'renewable energy', 'solar energy', 'wind energy', 'power system', 'fuel cell', 'battery']],
  ['Environmental Engineering',   ['environmental engineering', 'water treatment', 'air quality', 'sustainability', 'pollution', 'climate']],
  ['Aerospace Engineering',       ['aerospace', 'aeronautics', 'spacecraft', 'propulsion', 'orbital mechanics', 'flight dynamics']],
];

function deriveSpec(title) {
  if (!title) return null;
  const lower = title.toLowerCase();
  for (const [label, keywords] of SPEC_KEYWORDS) {
    if (keywords.some(kw => lower.includes(kw))) return label;
  }
  return null;
}

function fromPrefix(num) {
  if (!num) return null;
  const upper = num.split('.')[0].toUpperCase();
  // Try longest prefix first (21A before 21)
  if (PREFIX_MAP[upper]) return PREFIX_MAP[upper];
  const short = upper.replace(/[A-Z]+$/, '');
  return PREFIX_MAP[short] || null;
}

function flatStr(v) {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(flatStr).filter(Boolean).join(', ');
  if (typeof v === 'object') return v.name || v.title || v.department_name || '';
  return '';
}

function parseCourse(c) {
  const nums = [
    ...(c.course_nums || []),
    ...(c.course_numbers || []),
    c.coursenum ? [c.coursenum] : [],
  ].flat()
    .map(n => (typeof n === 'string' ? n : n.coursenum || n.course_num || n.number || ''))
    .filter(Boolean);

  const prefixInfo = fromPrefix(nums[0]);

  // Topics carry a three-level hierarchy: grandparent → parent → name
  const rawTopics = c.topics || c.topic_list || [];
  const t0 = rawTopics[0] || {};
  const topicField    = t0.grandparent_name || t0.grandparent || t0.discipline || '';
  const topicSubfield = t0.parent_name      || t0.parent      || t0.subtopic   || '';
  const topicSpec     = t0.name             || t0.topic_name  || t0.title      || '';

  // Department field from API, fallback to prefix map
  const apiDept = flatStr(c.department_name || c.departments || c.department || c.offered_by || '');

  const title    = c.title || c.run_title || c.course_title || '';
  const field    = topicField    || prefixInfo?.field || 'Other';
  const subfield = topicSubfield || apiDept           || prefixInfo?.dept || 'General';
  const spec     = topicSpec     || deriveSpec(title) || (Array.isArray(c.level) ? c.level.join('/') : c.level) || 'General';

  const level = Array.isArray(c.level) ? c.level.join(' / ') : (c.level || '');
  const instructors = (c.instructors || c.course_staff || [])
    .map(i => i.full_name || `${i.first_name || ''} ${i.last_name || ''}`.trim() || i.name || '')
    .filter(Boolean);

  return {
    id:          c.id || c.course_id || '',
    title,
    url:         c.url ? (c.url.startsWith('http') ? c.url : `https://ocw.mit.edu${c.url}`) : '',
    courseNums:  nums,
    field,
    subfield,
    spec,
    level,
    semester:    c.semester || c.term || '',
    year:        c.year || '',
    description: c.short_description || c.description || c.course_description || '',
    instructors,
  };
}

export function clearMITCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch {}
}

export async function fetchAllMITCourses(onProgress, force = false) {
  if (!force) {
    const cached = loadFromCache();
    if (cached) {
      onProgress?.(cached.length, cached.length);
      return cached;
    }
  }

  const limit = 100;
  let offset = 0;
  let total = null;
  const all = [];

  while (total === null || offset < total) {
    let data;
    try {
      const resp = await fetch(`/api/mit-courses?limit=${limit}&offset=${offset}`);
      if (!resp.ok) break;
      data = await resp.json();
    } catch { break; }

    if (total === null) {
      total = data.count ?? data.total ?? data.meta?.total_count ?? 0;
    }

    const results = data.results ?? data.hits ?? data.data ?? data.courses ?? (Array.isArray(data) ? data : []);
    const batch = results.map(parseCourse).filter(c => c.title);
    all.push(...batch);
    offset += limit;
    onProgress?.(all.length, total || all.length);
    if (batch.length < limit) break;
  }

  if (all.length > 0) saveToCache(all);
  return all;
}

// Returns: { field: { subfield: { spec: [course,...] } } }
export function groupCoursesTree(courses) {
  const tree = {};

  for (const course of courses) {
    const { field, subfield, spec } = course;
    if (!tree[field]) tree[field] = {};
    if (!tree[field][subfield]) tree[field][subfield] = {};
    if (!tree[field][subfield][spec]) tree[field][subfield][spec] = [];
    tree[field][subfield][spec].push(course);
  }

  // Sort courses within each spec by course number
  for (const f of Object.values(tree)) {
    for (const sf of Object.values(f)) {
      for (const sp of Object.keys(sf)) {
        sf[sp].sort((a, b) =>
          (a.courseNums[0] || '').localeCompare(b.courseNums[0] || '', undefined, { numeric: true })
        );
      }
    }
  }

  return tree;
}

export function treeFieldList(tree) {
  return Object.keys(tree)
    .map(field => ({
      field,
      count: Object.values(tree[field])
        .flatMap(sf => Object.values(sf))
        .reduce((s, arr) => s + arr.length, 0),
    }))
    .sort((a, b) => b.count - a.count);
}
