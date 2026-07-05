/**
 * Post-processes the UDC checkpoint into a clean structured hierarchy.
 * Run after scrape_eth_udc.mjs finishes.
 */
import { readFileSync, writeFileSync } from 'fs';

// Official UDC division names (1- and 2-digit levels)
const UDC_NAMES = {
  '0': 'Science and Knowledge. Organization. Information',
  '00': 'Prolegomena. Fundamentals of knowledge',
  '001': 'Science and knowledge in general',
  '002': 'Documentation. Books. Writing. Authorship',
  '003': 'Writing systems and scripts',
  '004': 'Computer science and technology',
  '005': 'Management',
  '007': 'Activity. Organization. Cybernetics. Communication',
  '008': 'Civilization. Culture. Progress',
  '02': 'Library science',
  '07': 'Journalism. Mass media',

  '1': 'Philosophy. Psychology',
  '11': 'Metaphysics',
  '12': 'Nature. Matter. Cosmos',
  '13': 'Philosophy of mind and spirit',
  '14': 'Philosophical systems and schools',
  '15': 'Psychology',
  '16': 'Logic. Theory of knowledge. Epistemology',
  '17': 'Ethics. Moral philosophy',

  '2': 'Religion. Theology',
  '21': 'Natural theology. Theodicy',
  '22': 'The Bible',
  '23': 'Christianity',
  '24': 'Buddhism',
  '25': 'Worship. Pastoral work',
  '26': 'Christian Church',
  '27': 'History of Christianity',
  '28': 'Christian denominations',
  '29': 'Non-Christian religions',

  '3': 'Social Sciences',
  '30': 'Social sciences in general. Sociography',
  '31': 'Statistics. Demography',
  '32': 'Politics. Political science',
  '33': 'Economics',
  '34': 'Law. Jurisprudence',
  '35': 'Public administration. Government. Military affairs',
  '36': 'Social welfare. Social work',
  '37': 'Education',
  '38': 'Ethnography. Folklore. Customs. Traditions',
  '39': 'Cultural anthropology',

  '5': 'Natural Sciences. Mathematics',
  '50': 'General aspects of natural sciences',
  '51': 'Mathematics',
  '511': 'Number theory',
  '512': 'Algebra',
  '513': 'Geometry',
  '514': 'Geometry',
  '515': 'Topology',
  '517': 'Analysis. Calculus',
  '518': 'Numerical analysis. Computational mathematics',
  '519': 'Probability. Statistics. Operations research',
  '52': 'Astronomy. Astrophysics. Space research',
  '53': 'Physics',
  '531': 'Mechanics',
  '532': 'Fluid mechanics',
  '533': 'Mechanics of gases',
  '534': 'Vibration. Acoustics',
  '535': 'Optics',
  '536': 'Heat. Thermodynamics',
  '537': 'Electricity. Electromagnetism',
  '538': 'Solid state physics. Magnetism',
  '539': 'Atomic and nuclear physics. Particle physics',
  '54': 'Chemistry. Crystallography. Mineralogy',
  '541': 'Physical chemistry. Theoretical chemistry',
  '542': 'Practical laboratory chemistry',
  '543': 'Analytical chemistry',
  '544': 'Physical chemistry',
  '546': 'Inorganic chemistry',
  '547': 'Organic chemistry',
  '548': 'Crystallography',
  '549': 'Mineralogy',
  '55': 'Earth sciences. Geology',
  '551': 'Geology. Meteorology. Climatology. Hydrology',
  '552': 'Petrology. Petrography',
  '553': 'Economic geology. Mineral deposits',
  '556': 'Hydrosphere. Water',
  '56': 'Palaeontology',
  '57': 'Biological sciences',
  '571': 'General biology. Biophysics. Biochemistry',
  '572': 'Physical anthropology. Human biology',
  '573': 'General biology. Cell biology',
  '574': 'Ecology. Biogeography',
  '575': 'Genetics. Evolution',
  '576': 'Cellular and subcellular biology',
  '577': 'Biochemistry. Molecular biology',
  '578': 'Virology',
  '579': 'Microbiology',
  '58': 'Botany',
  '581': 'General botany',
  '582': 'Systematic botany',
  '59': 'Zoology',
  '591': 'General zoology',
  '592': 'Invertebrates',
  '595': 'Arthropoda. Insects',
  '596': 'Vertebrates',
  '597': 'Fishes. Reptiles. Amphibia',
  '598': 'Birds',
  '599': 'Mammals',

  '6': 'Applied Sciences. Medicine. Technology',
  '61': 'Medicine. Medical sciences',
  '611': 'Anatomy',
  '612': 'Physiology',
  '613': 'Hygiene. Personal health',
  '614': 'Public health',
  '615': 'Pharmacology. Therapeutics',
  '616': 'Pathology. Clinical medicine',
  '617': 'Surgery. Orthopaedics. Ophthalmology',
  '618': 'Gynaecology. Obstetrics',
  '619': 'Veterinary medicine',
  '62': 'Engineering. Technology',
  '621': 'Mechanical engineering',
  '622': 'Mining engineering',
  '623': 'Military engineering',
  '624': 'Civil engineering. Structural engineering',
  '625': 'Road and railway engineering',
  '626': 'Hydraulic engineering',
  '627': 'Hydraulic engineering (rivers, ports)',
  '628': 'Environmental engineering. Sanitary engineering',
  '629': 'Vehicles. Transport engineering',
  '63': 'Agriculture. Forestry. Horticulture',
  '631': 'Agronomy. Soil science',
  '632': 'Plant pathology',
  '633': 'Field crops',
  '634': 'Horticulture. Fruit growing',
  '635': 'Vegetables. Gardening',
  '636': 'Animal husbandry. Livestock',
  '637': 'Animal products',
  '638': 'Insects. Apiculture',
  '639': 'Hunting. Fishing. Aquaculture',
  '64': 'Domestic science. Household management',
  '65': 'Communication. Transport. Commerce',
  '651': 'Office organization',
  '652': 'Postal services',
  '653': 'Telegraphy. Telephony',
  '654': 'Telecommunications',
  '655': 'Printing. Publishing',
  '656': 'Transport. Traffic',
  '657': 'Accounting',
  '658': 'Management. Business organization',
  '659': 'Advertising. Public relations',
  '66': 'Chemical technology',
  '661': 'Industrial chemicals',
  '662': 'Fuels. Explosives',
  '663': 'Food technology (beverages)',
  '664': 'Food technology',
  '665': 'Oils. Fats. Waxes',
  '666': 'Ceramics. Glass',
  '667': 'Surface coatings. Adhesives',
  '668': 'Chemical technology (misc)',
  '669': 'Metallurgy',
  '67': 'Various industries and trades',
  '68': 'Industries for finished products',
  '69': 'Building. Construction',

  '7': 'Arts. Recreation. Entertainment. Sport',
  '71': 'Town planning. Landscape architecture',
  '72': 'Architecture',
  '73': 'Sculpture',
  '74': 'Drawing. Applied art. Design',
  '75': 'Painting',
  '76': 'Printmaking and prints',
  '77': 'Photography',
  '78': 'Music',
  '79': 'Recreation. Entertainment. Sport',
  '791': 'Film. Cinema',
  '792': 'Theatre',
  '793': 'Dance. Social entertainments',
  '794': 'Board games. Card games',
  '796': 'Sport. Outdoor games',
  '797': 'Aquatic sports. Air sports',
  '798': 'Equestrian sport',
  '799': 'Hunting. Shooting',

  '8': 'Linguistics. Language. Literature',
  '80': 'General questions of linguistics',
  '801': 'Linguistics theory',
  '802': 'English and Old English',
  '803': 'Germanic languages',
  '804': 'Romance languages',
  '805': 'Italian. Romanian',
  '806': 'Spanish. Portuguese',
  '807': 'Latin',
  '808': 'Other languages',
  '809': 'Non-Indo-European languages',
  '81': 'Linguistics',
  '82': 'Literature',
  '821': 'Literature in specific languages',

  '9': 'Geography. Biography. History',
  '90': 'Archaeology. Prehistory',
  '91': 'Geography. Exploration',
  '92': 'Biography',
  '93': 'History',
  '94': 'History of Europe',
  '95': 'History of Asia',
  '96': 'History of Africa',
  '97': 'History of North America',
  '98': 'History of South America',
  '99': 'History of other areas',
};

// UDC codes excluded because they represent cataloguing infrastructure,
// not scholarly disciplines — clicking them can't produce a meaningful reading path.
// Each entry excludes that code AND all its descendants (prefix match).
const EXCLUDED_PREFIXES = [
  '006', // Standardization — procedural, not a field of study
  '01',  // Bibliography and bibliographies — meta-bibliographic
  '03',  // Reference works, Encyclopaedias, Dictionaries — meta
  '05',  // Serial publications, Periodicals — meta
  '06',  // Organizations and cooperation — institutional/admin
  '08',  // Collected works — meta
  '09',  // Manuscripts, Rare and remarkable works — archival/meta
];

function isExcluded(code) {
  return EXCLUDED_PREFIXES.some(ex => code === ex || code.startsWith(ex));
}

function isAcademicCode(code) {
  if (!code || code.length === 0) return false;
  if (!/^\d/.test(code)) return false;
  if (!/^\d+(\.\d+)*$/.test(code)) return false;
  if (code.startsWith('4')) return false;
  if (isExcluded(code)) return false;
  // Standard UDC uses at most one dot; multi-dot codes are ETH-specific extensions
  // that create orphan chains and excessive depth
  if ((code.match(/\./g) || []).length > 1) return false;
  return true;
}

function getParent(code) {
  const dotIdx = code.lastIndexOf('.');
  if (dotIdx >= 0) {
    const afterDot = code.slice(dotIdx + 1);
    // If 2+ digits after last dot, strip one digit: "512.531" → "512.53"
    if (afterDot.length > 1) return code.slice(0, -1);
    // If 1 digit after dot, strip the .X entirely: "512.5" → "512"
    return code.slice(0, dotIdx);
  }
  if (code.length > 1) return code.slice(0, -1);
  return null;
}

function canonicalName(code, terms) {
  // Prefer hardcoded name
  if (UDC_NAMES[code]) return UDC_NAMES[code];
  if (!terms || terms.length === 0) return code;
  // Prefer terms without parentheticals (most general)
  const clean = terms.filter(t => !t.includes('('));
  const pool = clean.length > 0 ? clean : terms;
  // Pick shortest
  return pool.sort((a, b) => a.length - b.length)[0];
}

// Load checkpoint
const ckpt = JSON.parse(readFileSync('scripts/.udc_checkpoint.json', 'utf8'));
const raw  = ckpt.entries;
console.error(`Raw entries: ${raw.length}`);

// Filter to clean academic codes
const academic = raw.filter(e => isAcademicCode(e.code));
console.error(`Academic: ${academic.length}`);

// Build code → {name candidates, terms} map
const codeData = new Map(); // code → { exactNames: [], terms: [] }

for (const { name, code } of academic) {
  if (!codeData.has(code)) codeData.set(code, { exactNames: [], terms: [] });
  const entry = codeData.get(code);
  // If this looks like a section heading (short, clean), add as exactName
  const stripped = name.replace(/\(.*?\)/g, '').trim();
  if (stripped.length < 60) entry.exactNames.push(stripped);
  entry.terms.push(name);
}

// Build full node map with proper names
const nodeMap = new Map();

function ensureNode(code) {
  if (!nodeMap.has(code)) {
    const data  = codeData.get(code);
    const names = data?.exactNames || [];
    nodeMap.set(code, {
      code,
      name: canonicalName(code, names),
      terms: data?.terms || [],
      children: new Set(),
    });
    const parent = getParent(code);
    if (parent) {
      ensureNode(parent);
      nodeMap.get(parent).children.add(code);
    }
  }
}

// Ensure all main + division codes exist with proper names
for (const code of Object.keys(UDC_NAMES)) {
  if (!code.startsWith('4') && !isExcluded(code)) ensureNode(code);
}
// Add all scraped codes
for (const code of codeData.keys()) ensureNode(code);

console.error(`Total nodes: ${nodeMap.size}`);

function sortCodes(a, b) {
  const na = parseFloat(a), nb = parseFloat(b);
  return na - nb || a.localeCompare(b);
}

// Collect serializable children, skipping orphan intermediates (name === code)
// by promoting their children one level up.
function resolvedChildren(code) {
  const node = nodeMap.get(code);
  if (!node) return [];
  return [...node.children].sort(sortCodes).flatMap(c => {
    const child = nodeMap.get(c);
    if (!child) return [];
    return child.name === c ? resolvedChildren(c) : [c];
  });
}

function serializeNode(code, depth) {
  const node = nodeMap.get(code);
  if (!node) return null;
  const children = resolvedChildren(code)
    .map(c => serializeNode(c, depth + 1))
    .filter(Boolean);

  // Only include terms at leaf nodes — keeps JSON manageable
  const terms = children.length === 0
    ? [...new Set(node.terms)].sort().slice(0, 100).map(t =>
        t.split(' ')
          .map(w => w.length > 3 ? w[0] + w.slice(1).toLowerCase() : w.toLowerCase())
          .join(' ')
      )
    : [];

  return { code, name: node.name, children, terms };
}

const roots = ['0','1','2','3','5','6','7','8','9']
  .filter(d => nodeMap.has(d))
  .map(d => serializeNode(d, 0))
  .filter(Boolean);

let totalNodes = 0, totalTerms = 0;
function countTree(n) {
  totalNodes++;
  totalTerms += n.terms.length;
  n.children.forEach(countTree);
}
roots.forEach(countTree);
console.error(`Tree: ${roots.length} main classes | ${totalNodes} nodes | ${totalTerms} leaf terms`);

writeFileSync('public/data/udc-full.json', JSON.stringify(roots));
const size = JSON.stringify(roots).length;
console.error(`Written → public/data/udc-full.json (${(size/1024).toFixed(0)}KB)`);
