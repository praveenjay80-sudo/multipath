import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(readFileSync(join(__dirname, 'ospData.json'), 'utf8'));

// Discipline group → OSP field names
const DISCIPLINE_GROUPS = {
  'STEM': ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'Engineering', 'Earth Sciences', 'Astronomy', 'Atmospheric Sciences'],
  'Social Sciences': ['Psychology', 'Economics', 'Sociology', 'Political Science', 'Anthropology', 'Geography', 'Women\'s Studies'],
  'Humanities': ['Philosophy', 'History', 'English Literature', 'Linguistics', 'Classics', 'Religion', 'Theology', 'Fine Arts', 'Music', 'Theatre Arts', 'Film and Photography'],
  'Professional': ['Business', 'Law', 'Medicine', 'Nursing', 'Accounting', 'Marketing', 'Architecture', 'Social Work', 'Education', 'Journalism', 'Library Science', 'Public Safety', 'Health Technician', 'Dentistry', 'Veterinary Medicine', 'Nutrition', 'Criminal Justice', 'Military Science', 'Agriculture'],
  'Languages': ['Spanish', 'French', 'German', 'Japanese', 'Chinese', 'Arabic', 'Hebrew', 'English as a Second Language', 'Sign Language'],
  'Practical': ['Writing', 'Basic Skills', 'Basic Computer Skills', 'Fitness and Leisure', 'Media / Communications', 'Dance', 'Culinary Arts', 'Cosmetology', 'Mechanic / Repair Tech', 'Transportation'],
};

// Subfields: field name → [{name, keywords}]
// Keywords matched case-insensitively against title text
const SUBFIELD_DEFS = {
  Mathematics: [
    { name: 'Calculus', kw: ['calculus', 'limits', 'derivatives', 'integration', 'differential calculus', 'integral calculus'] },
    { name: 'Linear Algebra', kw: ['linear algebra', 'matrix', 'matrices', 'vector space', 'eigenvector', 'eigenvalue'] },
    { name: 'Abstract Algebra', kw: ['abstract algebra', 'group theory', 'ring theory', 'field theory', 'galois', 'algebraic structures'] },
    { name: 'Real Analysis', kw: ['real analysis', 'mathematical analysis', 'measure theory', 'lebesgue', 'metric spaces'] },
    { name: 'Differential Equations', kw: ['differential equation', 'ordinary differential', 'partial differential', 'dynamical systems', 'boundary value'] },
    { name: 'Statistics & Probability', kw: ['statistics', 'probability', 'statistical inference', 'regression', 'bayesian', 'stochastic'] },
    { name: 'Number Theory', kw: ['number theory', 'prime numbers', 'integers', 'arithmetic', 'cryptography'] },
    { name: 'Topology', kw: ['topology', 'topological', 'manifolds', 'algebraic topology', 'differential topology'] },
    { name: 'Discrete Mathematics', kw: ['discrete', 'combinatorics', 'graph theory', 'logic', 'boolean algebra'] },
    { name: 'Geometry', kw: ['geometry', 'geometric', 'euclidean', 'projective', 'differential geometry'] },
    { name: 'Numerical Methods', kw: ['numerical', 'computational mathematics', 'numerical analysis', 'numerical methods'] },
  ],
  Physics: [
    { name: 'Classical Mechanics', kw: ['classical mechanics', 'newtonian', 'analytical mechanics', 'lagrangian', 'hamiltonian'] },
    { name: 'Quantum Mechanics', kw: ['quantum', 'wave function', 'schrödinger', 'schrodinger', 'quantum field', 'quantum physics', 'quantum theory'] },
    { name: 'Thermodynamics', kw: ['thermodynamics', 'heat transfer', 'entropy', 'statistical mechanics', 'thermal'] },
    { name: 'Electromagnetism', kw: ['electromagnetism', 'electromagnetic', 'electric field', 'magnetic field', 'maxwell', 'electrodynamics'] },
    { name: 'Relativity', kw: ['relativity', 'general relativity', 'special relativity', 'spacetime', 'einsteinian'] },
    { name: 'Optics', kw: ['optics', 'optical', 'photonics', 'laser', 'wave optics'] },
    { name: 'Condensed Matter', kw: ['condensed matter', 'solid state', 'crystal', 'semiconductor', 'superconductor'] },
    { name: 'Astrophysics', kw: ['astrophysics', 'cosmology', 'stellar', 'planetary physics', 'gravitational waves'] },
    { name: 'Nuclear Physics', kw: ['nuclear physics', 'particle physics', 'subatomic', 'nuclear', 'radioactive', 'high energy physics'] },
  ],
  Chemistry: [
    { name: 'Organic Chemistry', kw: ['organic chemistry', 'organic synthesis', 'carbon compounds', 'stereochemistry', 'reaction mechanisms'] },
    { name: 'Inorganic Chemistry', kw: ['inorganic chemistry', 'inorganic', 'coordination chemistry', 'organometallic'] },
    { name: 'Physical Chemistry', kw: ['physical chemistry', 'thermochemistry', 'chemical kinetics', 'quantum chemistry', 'spectroscopy'] },
    { name: 'Analytical Chemistry', kw: ['analytical chemistry', 'analytical methods', 'chromatography', 'titration', 'mass spectrometry'] },
    { name: 'Biochemistry', kw: ['biochemistry', 'biochemical', 'enzymes', 'proteins', 'metabolic'] },
    { name: 'Environmental Chemistry', kw: ['environmental chemistry', 'green chemistry', 'chemical pollution', 'atmospheric chemistry'] },
    { name: 'Polymer Chemistry', kw: ['polymer', 'plastics', 'materials chemistry', 'nanochemistry'] },
  ],
  Biology: [
    { name: 'Molecular Biology', kw: ['molecular biology', 'DNA', 'RNA', 'molecular genetics', 'gene expression', 'genomics'] },
    { name: 'Cell Biology', kw: ['cell biology', 'cellular', 'cell signaling', 'membrane', 'organelles'] },
    { name: 'Genetics', kw: ['genetics', 'heredity', 'inheritance', 'chromosomes', 'alleles', 'mendel'] },
    { name: 'Ecology', kw: ['ecology', 'ecosystem', 'biodiversity', 'biomes', 'population ecology', 'environmental biology'] },
    { name: 'Evolutionary Biology', kw: ['evolution', 'evolutionary', 'natural selection', 'speciation', 'darwin'] },
    { name: 'Microbiology', kw: ['microbiology', 'microbial', 'bacteria', 'viruses', 'fungi', 'pathogen'] },
    { name: 'Anatomy & Physiology', kw: ['anatomy', 'physiology', 'organ systems', 'human biology'] },
    { name: 'Neuroscience', kw: ['neuroscience', 'neurobiology', 'neural', 'brain', 'nervous system'] },
    { name: 'Biochemistry', kw: ['biochemistry', 'biochemical', 'enzymes', 'metabolism'] },
    { name: 'Botany', kw: ['botany', 'plant biology', 'plant science', 'photosynthesis', 'plant physiology'] },
    { name: 'Marine Biology', kw: ['marine biology', 'oceanography', 'aquatic', 'marine ecology'] },
  ],
  'Computer Science': [
    { name: 'Algorithms & Data Structures', kw: ['algorithms', 'data structures', 'sorting', 'search algorithms', 'complexity'] },
    { name: 'Artificial Intelligence', kw: ['artificial intelligence', 'machine learning', 'deep learning', 'neural network', 'AI', 'natural language processing', 'computer vision'] },
    { name: 'Operating Systems', kw: ['operating systems', 'OS concepts', 'linux', 'unix', 'kernel', 'concurrency', 'threads'] },
    { name: 'Computer Networks', kw: ['computer networks', 'networking', 'TCP/IP', 'internet protocols', 'distributed systems', 'wireless networks'] },
    { name: 'Databases', kw: ['database', 'SQL', 'data management', 'relational', 'NoSQL', 'data modeling'] },
    { name: 'Programming Languages', kw: ['programming languages', 'compilers', 'interpreters', 'language design', 'type systems'] },
    { name: 'Software Engineering', kw: ['software engineering', 'software design', 'design patterns', 'agile', 'software development'] },
    { name: 'Computer Architecture', kw: ['computer architecture', 'digital systems', 'hardware', 'processor design', 'embedded systems'] },
    { name: 'Computer Graphics', kw: ['computer graphics', 'rendering', 'visualization', '3D', 'OpenGL', 'game development'] },
    { name: 'Cybersecurity', kw: ['security', 'cryptography', 'cybersecurity', 'network security', 'ethical hacking'] },
    { name: 'Theory of Computation', kw: ['theory of computation', 'automata', 'formal languages', 'computability', 'NP-completeness'] },
  ],
  Engineering: [
    { name: 'Electrical Engineering', kw: ['electrical engineering', 'circuit', 'electronics', 'signal processing', 'control systems', 'power systems'] },
    { name: 'Mechanical Engineering', kw: ['mechanical engineering', 'thermodynamics', 'fluid mechanics', 'materials science', 'dynamics', 'statics'] },
    { name: 'Civil Engineering', kw: ['civil engineering', 'structural engineering', 'transportation', 'geotechnical', 'hydraulics'] },
    { name: 'Chemical Engineering', kw: ['chemical engineering', 'process engineering', 'reactor design', 'transport phenomena'] },
    { name: 'Materials Science', kw: ['materials science', 'materials engineering', 'nanomaterials', 'metallurgy', 'polymers'] },
    { name: 'Biomedical Engineering', kw: ['biomedical engineering', 'biomechanics', 'medical devices', 'bioengineering'] },
    { name: 'Environmental Engineering', kw: ['environmental engineering', 'sustainability', 'water treatment', 'waste management'] },
    { name: 'Systems Engineering', kw: ['systems engineering', 'control theory', 'optimization', 'operations research'] },
  ],
  Economics: [
    { name: 'Microeconomics', kw: ['microeconomics', 'microeconomic', 'supply and demand', 'consumer theory', 'market structure', 'game theory'] },
    { name: 'Macroeconomics', kw: ['macroeconomics', 'macroeconomic', 'GDP', 'monetary policy', 'fiscal policy', 'inflation', 'unemployment'] },
    { name: 'Econometrics', kw: ['econometrics', 'time series', 'panel data', 'causal inference', 'economic statistics'] },
    { name: 'International Economics', kw: ['international economics', 'international trade', 'global economy', 'exchange rates', 'trade policy'] },
    { name: 'Development Economics', kw: ['development economics', 'developing countries', 'poverty', 'economic growth', 'institutions'] },
    { name: 'Behavioral Economics', kw: ['behavioral economics', 'behavioral finance', 'decision making', 'nudge', 'irrationality'] },
    { name: 'Financial Economics', kw: ['financial economics', 'investment', 'capital markets', 'asset pricing', 'derivatives'] },
    { name: 'Labor Economics', kw: ['labor economics', 'labor markets', 'wages', 'employment', 'human capital'] },
    { name: 'Public Economics', kw: ['public economics', 'public finance', 'taxation', 'public goods', 'externalities'] },
    { name: 'Industrial Organization', kw: ['industrial organization', 'market power', 'antitrust', 'oligopoly', 'monopoly'] },
  ],
  Psychology: [
    { name: 'Social Psychology', kw: ['social psychology', 'group behavior', 'attitude', 'persuasion', 'social influence', 'conformity'] },
    { name: 'Clinical Psychology', kw: ['clinical psychology', 'psychotherapy', 'cognitive behavioral', 'CBT', 'mental health treatment'] },
    { name: 'Cognitive Psychology', kw: ['cognitive psychology', 'cognition', 'memory', 'attention', 'perception', 'thinking'] },
    { name: 'Developmental Psychology', kw: ['developmental psychology', 'child development', 'lifespan', 'adolescent', 'aging'] },
    { name: 'Abnormal Psychology', kw: ['abnormal psychology', 'psychopathology', 'mental disorders', 'DSM', 'depression', 'anxiety disorders'] },
    { name: 'Biological Psychology', kw: ['biological psychology', 'biopsychology', 'behavioral neuroscience', 'neuropsychology', 'psychophysiology'] },
    { name: 'Personality Psychology', kw: ['personality', 'personality theories', 'individual differences', 'trait theory'] },
    { name: 'Research Methods', kw: ['research methods', 'experimental design', 'psychological measurement', 'statistics in psychology'] },
    { name: 'Industrial-Organizational', kw: ['industrial-organizational', 'I-O psychology', 'organizational behavior', 'work psychology'] },
    { name: 'Positive Psychology', kw: ['positive psychology', 'wellbeing', 'happiness', 'flourishing', 'resilience'] },
  ],
  Philosophy: [
    { name: 'Ethics', kw: ['ethics', 'moral philosophy', 'morality', 'ethical theory', 'applied ethics', 'metaethics'] },
    { name: 'Epistemology', kw: ['epistemology', 'knowledge', 'belief', 'justified true', 'skepticism', 'a priori'] },
    { name: 'Metaphysics', kw: ['metaphysics', 'ontology', 'existence', 'reality', 'substance', 'identity'] },
    { name: 'Logic', kw: ['logic', 'formal logic', 'argument', 'deduction', 'symbolic logic', 'modal logic'] },
    { name: 'Political Philosophy', kw: ['political philosophy', 'justice', 'rights', 'democracy', 'social contract', 'liberty'] },
    { name: 'Philosophy of Science', kw: ['philosophy of science', 'scientific method', 'falsification', 'paradigm', 'realism'] },
    { name: 'Philosophy of Mind', kw: ['philosophy of mind', 'consciousness', 'mental states', 'qualia', 'intentionality', 'free will'] },
    { name: 'Aesthetics', kw: ['aesthetics', 'beauty', 'art theory', 'philosophy of art', 'sublime'] },
    { name: 'Ancient Philosophy', kw: ['ancient philosophy', 'plato', 'aristotle', 'socrates', 'stoicism', 'pre-socratic'] },
    { name: 'Continental Philosophy', kw: ['continental philosophy', 'phenomenology', 'heidegger', 'existentialism', 'hermeneutics', 'deconstruction'] },
    { name: 'Analytic Philosophy', kw: ['analytic philosophy', 'philosophy of language', 'wittgenstein', 'russell', 'frege'] },
  ],
  History: [
    { name: 'Ancient History', kw: ['ancient', 'antiquity', 'roman empire', 'ancient greece', 'egypt', 'mesopotamia'] },
    { name: 'Medieval History', kw: ['medieval', 'middle ages', 'byzantine', 'crusades', 'feudalism'] },
    { name: 'Early Modern History', kw: ['early modern', 'renaissance', 'reformation', 'age of exploration', '16th century', '17th century'] },
    { name: 'Modern History', kw: ['modern history', '18th century', '19th century', 'industrialization', 'imperialism'] },
    { name: 'Contemporary History', kw: ['contemporary', '20th century', '21st century', 'world war', 'cold war', 'postwar'] },
    { name: 'American History', kw: ['american history', 'united states history', 'colonial america', 'civil war', 'us history'] },
    { name: 'European History', kw: ['european history', 'europe', 'france history', 'british history', 'german history'] },
    { name: 'World History', kw: ['world history', 'global history', 'comparative history', 'cross-cultural'] },
    { name: 'African History', kw: ['african history', 'africa', 'colonial africa', 'sub-saharan'] },
    { name: 'Asian History', kw: ['asian history', 'china history', 'japan history', 'india history', 'east asia', 'south asia'] },
    { name: 'Intellectual History', kw: ['intellectual history', 'history of ideas', 'history of philosophy', 'history of science'] },
    { name: 'Social & Cultural History', kw: ['social history', 'cultural history', 'women\'s history', 'labor history', 'everyday life'] },
  ],
  Sociology: [
    { name: 'Social Theory', kw: ['social theory', 'sociological theory', 'marx', 'weber', 'durkheim', 'parsons', 'bourdieu'] },
    { name: 'Race & Ethnicity', kw: ['race', 'ethnicity', 'racism', 'racial', 'ethnic identity', 'white supremacy'] },
    { name: 'Gender & Sexuality', kw: ['gender', 'feminism', 'sexuality', 'queer', 'patriarchy', 'feminist'] },
    { name: 'Urban Sociology', kw: ['urban', 'city', 'urban poverty', 'gentrification', 'community', 'neighborhood'] },
    { name: 'Stratification', kw: ['stratification', 'inequality', 'class', 'mobility', 'poverty'] },
    { name: 'Medical Sociology', kw: ['medical sociology', 'health disparities', 'sociology of health', 'illness'] },
    { name: 'Research Methods', kw: ['research methods', 'qualitative methods', 'quantitative methods', 'survey', 'ethnography'] },
    { name: 'Globalization', kw: ['globalization', 'global society', 'transnational', 'world systems'] },
  ],
  'Political Science': [
    { name: 'Comparative Politics', kw: ['comparative politics', 'comparative government', 'regime types', 'democratization'] },
    { name: 'International Relations', kw: ['international relations', 'IR theory', 'foreign policy', 'diplomacy', 'realism', 'liberalism in IR'] },
    { name: 'Political Theory', kw: ['political theory', 'political thought', 'normative theory', 'democratic theory'] },
    { name: 'American Politics', kw: ['american politics', 'congress', 'elections', 'voting behavior', 'presidency', 'US government'] },
    { name: 'Public Policy', kw: ['public policy', 'policy analysis', 'policy making', 'public administration'] },
    { name: 'Political Economy', kw: ['political economy', 'international political economy', 'IPE', 'state and market'] },
    { name: 'Security Studies', kw: ['security studies', 'conflict', 'war', 'nuclear deterrence', 'terrorism'] },
  ],
  Law: [
    { name: 'Constitutional Law', kw: ['constitutional law', 'constitution', 'fundamental rights', 'judicial review', 'bill of rights'] },
    { name: 'Criminal Law', kw: ['criminal law', 'criminal', 'crime', 'criminal procedure', 'criminal justice'] },
    { name: 'Contracts', kw: ['contracts', 'contract law', 'contract formation', 'consideration', 'breach'] },
    { name: 'Torts', kw: ['torts', 'tort law', 'negligence', 'liability', 'damages'] },
    { name: 'Property Law', kw: ['property law', 'property rights', 'real property', 'intellectual property'] },
    { name: 'International Law', kw: ['international law', 'treaty', 'human rights law', 'international courts'] },
    { name: 'Administrative Law', kw: ['administrative law', 'regulation', 'administrative agency', 'rulemaking'] },
    { name: 'Business Law', kw: ['business law', 'commercial law', 'corporate law', 'company law', 'securities law'] },
    { name: 'Environmental Law', kw: ['environmental law', 'environmental regulation', 'climate law', 'natural resources'] },
  ],
  'English Literature': [
    { name: 'British Literature', kw: ['british literature', 'english literature', 'victorian', 'romantic', 'shakespeare', 'chaucer', 'british novel'] },
    { name: 'American Literature', kw: ['american literature', 'american novel', 'american poetry', 'modernism', 'postmodernism'] },
    { name: 'World Literature', kw: ['world literature', 'global literature', 'postcolonial', 'comparative literature'] },
    { name: 'Literary Theory', kw: ['literary theory', 'literary criticism', 'narratology', 'structuralism', 'deconstruction'] },
    { name: 'Poetry', kw: ['poetry', 'poetics', 'lyric', 'versification', 'epic poetry'] },
    { name: 'Drama', kw: ['drama', 'playwriting', 'theatrical', 'tragedy', 'comedy'] },
    { name: 'Fiction', kw: ['novel', 'fiction', 'short story', 'narrative', 'fiction writing'] },
  ],
  Medicine: [
    { name: 'Internal Medicine', kw: ['internal medicine', 'cardiology', 'pulmonology', 'gastroenterology', 'nephrology', 'endocrinology'] },
    { name: 'Anatomy', kw: ['anatomy', 'gross anatomy', 'histology', 'neuroanatomy', 'regional anatomy'] },
    { name: 'Physiology', kw: ['physiology', 'human physiology', 'pathophysiology', 'systems physiology'] },
    { name: 'Pharmacology', kw: ['pharmacology', 'drugs', 'pharmacotherapy', 'pharmacokinetics', 'pharmacodynamics'] },
    { name: 'Surgery', kw: ['surgery', 'surgical', 'operative', 'general surgery', 'surgical anatomy'] },
    { name: 'Psychiatry', kw: ['psychiatry', 'psychiatric', 'mental health', 'psychopharmacology'] },
    { name: 'Pediatrics', kw: ['pediatrics', 'pediatric', 'child health', 'neonatology'] },
    { name: 'Public Health', kw: ['public health', 'epidemiology', 'biostatistics', 'global health', 'preventive medicine'] },
    { name: 'Pathology', kw: ['pathology', 'pathological', 'disease mechanisms', 'clinical pathology'] },
  ],
  Business: [
    { name: 'Management', kw: ['management', 'organizational behavior', 'leadership', 'strategic management', 'operations management'] },
    { name: 'Finance', kw: ['finance', 'financial management', 'corporate finance', 'investment', 'capital budgeting'] },
    { name: 'Marketing', kw: ['marketing', 'consumer behavior', 'brand management', 'market research', 'digital marketing'] },
    { name: 'Entrepreneurship', kw: ['entrepreneurship', 'startup', 'new venture', 'innovation', 'business creation'] },
    { name: 'International Business', kw: ['international business', 'global business', 'multinational', 'cross-cultural management'] },
    { name: 'Business Ethics', kw: ['business ethics', 'corporate social responsibility', 'CSR', 'ethical business'] },
    { name: 'Human Resources', kw: ['human resources', 'HR management', 'talent management', 'organizational development'] },
    { name: 'Operations', kw: ['operations', 'supply chain', 'logistics', 'project management', 'quality management'] },
  ],
  Anthropology: [
    { name: 'Cultural Anthropology', kw: ['cultural anthropology', 'ethnography', 'culture', 'kinship', 'ritual'] },
    { name: 'Biological Anthropology', kw: ['biological anthropology', 'physical anthropology', 'human evolution', 'primatology'] },
    { name: 'Archaeology', kw: ['archaeology', 'archaeological', 'excavation', 'material culture', 'prehistoric'] },
    { name: 'Linguistic Anthropology', kw: ['linguistic anthropology', 'language and culture', 'sociolinguistics'] },
    { name: 'Medical Anthropology', kw: ['medical anthropology', 'health and culture', 'illness', 'healing'] },
  ],
  Linguistics: [
    { name: 'Phonology & Phonetics', kw: ['phonology', 'phonetics', 'sounds', 'segmental', 'prosody'] },
    { name: 'Syntax', kw: ['syntax', 'grammatical structure', 'sentence structure', 'generative grammar', 'minimalist'] },
    { name: 'Semantics', kw: ['semantics', 'meaning', 'formal semantics', 'lexical semantics'] },
    { name: 'Pragmatics', kw: ['pragmatics', 'discourse', 'speech acts', 'conversation analysis'] },
    { name: 'Sociolinguistics', kw: ['sociolinguistics', 'language variation', 'dialectology', 'language and society'] },
    { name: 'Historical Linguistics', kw: ['historical linguistics', 'language change', 'etymology', 'comparative linguistics'] },
    { name: 'Psycholinguistics', kw: ['psycholinguistics', 'language acquisition', 'language processing', 'bilingualism'] },
    { name: 'Computational Linguistics', kw: ['computational linguistics', 'natural language processing', 'NLP', 'corpus linguistics'] },
  ],
  'Earth Sciences': [
    { name: 'Geology', kw: ['geology', 'geological', 'rocks', 'mineralogy', 'petrology', 'tectonics'] },
    { name: 'Geomorphology', kw: ['geomorphology', 'landforms', 'erosion', 'geomorphic processes'] },
    { name: 'Oceanography', kw: ['oceanography', 'ocean science', 'marine geology', 'ocean circulation'] },
    { name: 'Meteorology', kw: ['meteorology', 'weather', 'atmosphere', 'climate science'] },
    { name: 'Geochemistry', kw: ['geochemistry', 'isotope', 'chemical geology', 'biogeochemistry'] },
    { name: 'Environmental Earth Science', kw: ['environmental geology', 'natural hazards', 'soil science', 'hydrogeology'] },
  ],
  'Fine Arts': [
    { name: 'Art History', kw: ['art history', 'art movement', 'art criticism', 'visual culture', 'iconography'] },
    { name: 'Studio Art', kw: ['studio art', 'painting', 'drawing', 'sculpture', 'printmaking'] },
    { name: 'Design', kw: ['design', 'graphic design', 'typography', 'visual design', 'UX design'] },
    { name: 'Photography', kw: ['photography', 'photographic', 'digital photography', 'darkroom'] },
    { name: 'Contemporary Art', kw: ['contemporary art', 'modern art', 'installation', 'performance art'] },
  ],
  Music: [
    { name: 'Music Theory', kw: ['music theory', 'harmony', 'counterpoint', 'musical form', 'analysis'] },
    { name: 'Music History', kw: ['music history', 'history of music', 'western music', 'baroque', 'classical period', 'romantic music'] },
    { name: 'Music Performance', kw: ['performance', 'instrument', 'conducting', 'ensemble', 'orchestration'] },
    { name: 'Ethnomusicology', kw: ['ethnomusicology', 'world music', 'folk music', 'music and culture'] },
    { name: 'Music Technology', kw: ['music technology', 'music production', 'audio engineering', 'recording'] },
    { name: 'Jazz & Popular Music', kw: ['jazz', 'popular music', 'pop music', 'rock', 'hip-hop'] },
  ],
  Education: [
    { name: 'Curriculum & Instruction', kw: ['curriculum', 'instruction', 'teaching methods', 'pedagogy', 'lesson planning'] },
    { name: 'Educational Psychology', kw: ['educational psychology', 'learning theory', 'motivation', 'cognitive development'] },
    { name: 'Special Education', kw: ['special education', 'disability', 'inclusive education', 'learning disabilities'] },
    { name: 'Early Childhood', kw: ['early childhood', 'kindergarten', 'preschool', 'early learning', 'child development'] },
    { name: 'Higher Education', kw: ['higher education', 'university', 'college', 'academic', 'tertiary'] },
    { name: 'Educational Technology', kw: ['educational technology', 'e-learning', 'online learning', 'ed-tech', 'instructional design'] },
    { name: 'School Leadership', kw: ['school leadership', 'educational administration', 'principal', 'school management'] },
    { name: 'STEM Education', kw: ['STEM education', 'science education', 'mathematics education', 'engineering education'] },
  ],
  Architecture: [
    { name: 'Architectural History', kw: ['architectural history', 'history of architecture', 'classical architecture', 'modernism in architecture'] },
    { name: 'Urban Design', kw: ['urban design', 'urban planning', 'city planning', 'landscape architecture'] },
    { name: 'Building Technology', kw: ['building technology', 'construction', 'structural systems', 'building materials'] },
    { name: 'Sustainable Design', kw: ['sustainable design', 'green architecture', 'energy efficiency', 'environmental design'] },
    { name: 'Design Theory', kw: ['design theory', 'architectural theory', 'aesthetics', 'spatial design'] },
  ],
  Geography: [
    { name: 'Physical Geography', kw: ['physical geography', 'geomorphology', 'climate', 'biogeography', 'hydrology'] },
    { name: 'Human Geography', kw: ['human geography', 'cultural geography', 'population geography', 'urban geography'] },
    { name: 'Economic Geography', kw: ['economic geography', 'regional development', 'economic space', 'industrial location'] },
    { name: 'Political Geography', kw: ['political geography', 'geopolitics', 'borders', 'territory', 'sovereignty'] },
    { name: 'Geographic Information Systems', kw: ['GIS', 'geographic information systems', 'remote sensing', 'spatial analysis', 'cartography'] },
    { name: 'Development Geography', kw: ['development geography', 'global south', 'inequality', 'poverty geography'] },
  ],
  'Social Work': [
    { name: 'Clinical Social Work', kw: ['clinical social work', 'psychosocial', 'case management', 'therapy', 'counseling'] },
    { name: 'Community Practice', kw: ['community practice', 'community organizing', 'advocacy', 'policy practice'] },
    { name: 'Child & Family', kw: ['child welfare', 'family systems', 'foster care', 'child protection'] },
    { name: 'Social Policy', kw: ['social policy', 'welfare state', 'social services', 'policy analysis'] },
  ],
  Accounting: [
    { name: 'Financial Accounting', kw: ['financial accounting', 'financial statements', 'GAAP', 'IFRS', 'balance sheet'] },
    { name: 'Managerial Accounting', kw: ['managerial accounting', 'management accounting', 'cost accounting', 'budgeting'] },
    { name: 'Auditing', kw: ['auditing', 'audit', 'internal controls', 'external audit', 'assurance'] },
    { name: 'Taxation', kw: ['taxation', 'tax accounting', 'corporate tax', 'tax law', 'tax planning'] },
    { name: 'Accounting Information Systems', kw: ['accounting information systems', 'AIS', 'ERP', 'enterprise systems'] },
  ],
  Marketing: [
    { name: 'Consumer Behavior', kw: ['consumer behavior', 'buyer behavior', 'consumer decision making', 'consumer psychology'] },
    { name: 'Digital Marketing', kw: ['digital marketing', 'social media marketing', 'SEO', 'content marketing', 'online marketing'] },
    { name: 'Brand Management', kw: ['brand management', 'branding', 'brand equity', 'brand strategy'] },
    { name: 'Market Research', kw: ['market research', 'marketing research', 'consumer insights', 'survey research'] },
    { name: 'Strategic Marketing', kw: ['strategic marketing', 'marketing strategy', 'competitive strategy', 'positioning'] },
    { name: 'International Marketing', kw: ['international marketing', 'global marketing', 'cross-cultural marketing'] },
  ],
  Nursing: [
    { name: 'Medical-Surgical Nursing', kw: ['medical-surgical', 'adult health', 'nursing care', 'clinical nursing'] },
    { name: 'Pediatric Nursing', kw: ['pediatric nursing', 'child health nursing', 'neonatal nursing'] },
    { name: 'Psychiatric Nursing', kw: ['psychiatric nursing', 'mental health nursing', 'psychiatric-mental health'] },
    { name: 'Community Health Nursing', kw: ['community health nursing', 'public health nursing', 'population health'] },
    { name: 'Nursing Theory', kw: ['nursing theory', 'nursing concepts', 'nursing models', 'nursing ethics'] },
  ],
  Religion: [
    { name: 'World Religions', kw: ['world religions', 'comparative religion', 'religion overview', 'religious traditions'] },
    { name: 'Christianity', kw: ['christianity', 'christian theology', 'new testament', 'church history'] },
    { name: 'Islam', kw: ['islam', 'islamic studies', 'quran', 'hadith', 'muslim'] },
    { name: 'Judaism', kw: ['judaism', 'jewish studies', 'talmud', 'torah', 'jewish history'] },
    { name: 'Hinduism', kw: ['hinduism', 'hindu philosophy', 'vedas', 'upanishads', 'yoga'] },
    { name: 'Buddhism', kw: ['buddhism', 'buddhist', 'dharma', 'nirvana', 'meditation'] },
    { name: 'Religious Studies Methods', kw: ['religious studies', 'study of religion', 'sociology of religion', 'psychology of religion'] },
  ],
  Theology: [
    { name: 'Systematic Theology', kw: ['systematic theology', 'dogmatic', 'doctrine', 'trinity', 'christology'] },
    { name: 'Biblical Studies', kw: ['biblical studies', 'old testament', 'new testament', 'exegesis', 'hermeneutics'] },
    { name: 'Ethics & Moral Theology', kw: ['moral theology', 'theological ethics', 'christian ethics'] },
    { name: 'Church History', kw: ['church history', 'history of christianity', 'reformation', 'patristics'] },
    { name: 'Pastoral Theology', kw: ['pastoral', 'ministry', 'pastoral care', 'preaching', 'homiletics'] },
  ],
  'Media / Communications': [
    { name: 'Mass Communication', kw: ['mass communication', 'media studies', 'broadcasting', 'media theory'] },
    { name: 'Journalism', kw: ['journalism', 'reporting', 'news writing', 'investigative journalism'] },
    { name: 'Digital Media', kw: ['digital media', 'social media', 'new media', 'online communication'] },
    { name: 'Public Relations', kw: ['public relations', 'PR', 'strategic communication', 'crisis communication'] },
    { name: 'Media & Society', kw: ['media and society', 'political communication', 'media effects', 'agenda setting'] },
  ],
  Astronomy: [
    { name: 'Astrophysics', kw: ['astrophysics', 'stellar astrophysics', 'galactic', 'astrophysical'] },
    { name: 'Cosmology', kw: ['cosmology', 'big bang', 'dark matter', 'dark energy', 'early universe'] },
    { name: 'Planetary Science', kw: ['planetary science', 'solar system', 'planetary geology', 'exoplanets'] },
    { name: 'Observational Astronomy', kw: ['observational', 'telescope', 'spectroscopy', 'photometry', 'radio astronomy'] },
  ],
  Agriculture: [
    { name: 'Crop Science', kw: ['crop science', 'agronomy', 'crop production', 'soil science', 'fertilization'] },
    { name: 'Animal Science', kw: ['animal science', 'livestock', 'veterinary', 'animal nutrition', 'animal husbandry'] },
    { name: 'Agricultural Economics', kw: ['agricultural economics', 'farm management', 'food economics', 'agribusiness'] },
    { name: 'Food Science', kw: ['food science', 'food technology', 'food safety', 'food processing', 'nutrition'] },
    { name: 'Environmental Agriculture', kw: ['sustainable agriculture', 'agroecology', 'organic farming', 'conservation'] },
  ],
  'Criminal Justice': [
    { name: 'Criminology', kw: ['criminology', 'crime theories', 'deviance', 'delinquency', 'criminal behavior'] },
    { name: 'Law Enforcement', kw: ['law enforcement', 'policing', 'police', 'patrol', 'investigations'] },
    { name: 'Corrections', kw: ['corrections', 'prisons', 'incarceration', 'probation', 'parole', 'rehabilitation'] },
    { name: 'Juvenile Justice', kw: ['juvenile justice', 'juvenile delinquency', 'youth offending'] },
  ],
  'Public Safety': [
    { name: 'Emergency Management', kw: ['emergency management', 'disaster response', 'crisis management', 'homeland security'] },
    { name: 'Fire Science', kw: ['fire science', 'firefighting', 'fire prevention', 'fire protection'] },
  ],
  'Health Technician': [
    { name: 'Medical Lab Technology', kw: ['medical laboratory', 'clinical laboratory', 'lab technician', 'pathology lab'] },
    { name: 'Radiology', kw: ['radiology', 'radiologic technology', 'imaging', 'MRI', 'X-ray'] },
    { name: 'Respiratory Therapy', kw: ['respiratory therapy', 'respiratory care', 'pulmonary'] },
    { name: 'Physical Therapy', kw: ['physical therapy', 'physiotherapy', 'rehabilitation'] },
  ],
};

// Group field → discipline
const fieldToGroup = {};
for (const [group, fields] of Object.entries(DISCIPLINE_GROUPS)) {
  for (const f of fields) fieldToGroup[f] = group;
}

function matchSubfields(title, fieldName) {
  const defs = SUBFIELD_DEFS[fieldName];
  if (!defs) return [];
  const lower = title.toLowerCase();
  const matched = [];
  for (const def of defs) {
    for (const kw of def.kw) {
      if (lower.includes(kw.toLowerCase())) {
        matched.push(def.name);
        break;
      }
    }
  }
  return matched;
}

// Build the constants
const fields = raw.fields.map(f => ({ id: f.id, name: f.name, syllabi: f.syllabi, group: fieldToGroup[f.name] || 'Other' }));
fields.sort((a, b) => b.syllabi - a.syllabi);

const titlesByField = {};
const subfieldsByField = {};

for (const f of fields) {
  const rawTitles = raw.byField[f.name] || [];
  const titles = rawTitles.map((t, i) => {
    const subs = matchSubfields(t.title, f.name);
    return {
      rank: t.rank || (i + 1),
      title: t.title,
      authors: t.authors || '',
      score: t.score || 0,
      appearances: t.appearances || 0,
      year: t.year || null,
      subfields: subs,
    };
  });
  titlesByField[f.name] = titles;

  // Build subfield index: subfield name → title indices
  const sfMap = {};
  if (SUBFIELD_DEFS[f.name]) {
    for (const def of SUBFIELD_DEFS[f.name]) sfMap[def.name] = [];
    for (let i = 0; i < titles.length; i++) {
      for (const sf of titles[i].subfields) {
        if (!sfMap[sf]) sfMap[sf] = [];
        sfMap[sf].push(i);
      }
    }
  }
  subfieldsByField[f.name] = sfMap;
}

const globalTop = raw.globalTop100 || [];

const out = `// Auto-generated by scripts/generate-osp-data.mjs — do not edit
// Crawled: ${raw.crawledAt}
// ${raw.meta.totalSyllabi.toLocaleString()} total syllabi · ${raw.meta.totalTitles.toLocaleString()} total titles · ${fields.length} fields

export const OSP_CRAWL_DATE = ${JSON.stringify(raw.crawledAt)};
export const OSP_META = ${JSON.stringify(raw.meta)};
export const OSP_FIELDS = ${JSON.stringify(fields)};
export const OSP_TITLES_BY_FIELD = ${JSON.stringify(titlesByField)};
export const OSP_SUBFIELDS_BY_FIELD = ${JSON.stringify(subfieldsByField)};
export const OSP_GLOBAL_TOP = ${JSON.stringify(globalTop)};

export const OSP_DISCIPLINE_GROUPS = ${JSON.stringify(DISCIPLINE_GROUPS)};

export const OSP_SUBFIELD_NAMES = ${JSON.stringify(
  Object.fromEntries(Object.entries(SUBFIELD_DEFS).map(([k, v]) => [k, v.map(d => d.name)]))
)};
`;

writeFileSync(join(__dirname, '..', 'src', 'constants', 'ospData.js'), out, 'utf8');
console.log('Generated src/constants/ospData.js');
console.log('Fields:', fields.length);
console.log('Fields with subfields:', Object.keys(SUBFIELD_DEFS).length);

// Coverage stats
let totalTitles = 0;
let subfieldMatched = 0;
for (const f of fields) {
  const titles = titlesByField[f.name];
  totalTitles += titles.length;
  subfieldMatched += titles.filter(t => t.subfields.length > 0).length;
}
console.log(`Total titles: ${totalTitles}, subfield-matched: ${subfieldMatched} (${Math.round(subfieldMatched/totalTitles*100)}%)`);
