// ============================================================
// Open Syllabus Project — Full Paginated Titles Crawler
// Run this in the browser console at: https://analytics.opensyllabus.org
//
// Usage:
//   1. Open https://analytics.opensyllabus.org in Chrome
//   2. Open DevTools (F12) → Console tab
//   3. Paste this entire script and press Enter
//   4. Wait ~20-40 minutes for all 65 fields to crawl
//   5. A file "ospData.json" will auto-download when done
//   6. Copy it to: C:/Users/prave/Projects/canon/scripts/ospData.json
//   7. Then run: node scripts/generate-osp-data.mjs
// ============================================================

(async () => {
  const API = 'https://api.opensyllabus.org/api';
  const PAGE_SIZE = 200;
  const DELAY_MS = 250;    // between pages within a field
  const FIELD_DELAY = 600; // between fields

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // All 65 OSP fields with correct IDs
  const FIELDS = [
    { id: '11', name: 'Business', syllabi: 1509692 },
    { id: '27', name: 'Engineering', syllabi: 1303370 },
    { id: '16', name: 'Computer Science', syllabi: 1171457 },
    { id: '47', name: 'Mathematics', syllabi: 1005119 },
    { id: '26', name: 'Education', syllabi: 914441 },
    { id: '29', name: 'English Literature', syllabi: 893481 },
    { id: '10', name: 'Biology', syllabi: 761148 },
    { id: '59', name: 'Psychology', syllabi: 625273 },
    { id: '39', name: 'History', syllabi: 619451 },
    { id: '42', name: 'Law', syllabi: 534910 },
    { id: '50', name: 'Medicine', syllabi: 479918 },
    { id: '32', name: 'Fine Arts', syllabi: 458346 },
    { id: '58', name: 'Political Science', syllabi: 455176 },
    { id: '25', name: 'Economics', syllabi: 412212 },
    { id: '13', name: 'Chemistry', syllabi: 386338 },
    { id: '52', name: 'Music', syllabi: 383797 },
    { id: '45', name: 'Linguistics', syllabi: 379582 },
    { id: '54', name: 'Nursing', syllabi: 342311 },
    { id: '33', name: 'Fitness and Leisure', syllabi: 329978 },
    { id: '49', name: 'Media / Communications', syllabi: 316475 },
    { id: '57', name: 'Physics', syllabi: 309111 },
    { id: '65', name: 'Sociology', syllabi: 297472 },
    { id: '56', name: 'Philosophy', syllabi: 254398 },
    { id: '1',  name: 'Accounting', syllabi: 233696 },
    { id: '5',  name: 'Architecture', syllabi: 225729 },
    { id: '3',  name: 'Anthropology', syllabi: 209750 },
    { id: '46', name: 'Marketing', syllabi: 196831 },
    { id: '2',  name: 'Agriculture', syllabi: 190758 },
    { id: '31', name: 'Film and Photography', syllabi: 177941 },
    { id: '66', name: 'Spanish', syllabi: 171825 },
    { id: '64', name: 'Social Work', syllabi: 165878 },
    { id: '24', name: 'Earth Sciences', syllabi: 164180 },
    { id: '35', name: 'Geography', syllabi: 158159 },
    { id: '37', name: 'Health Technician', syllabi: 137607 },
    { id: '36', name: 'German', syllabi: 135727 },
    { id: '34', name: 'French', syllabi: 130698 },
    { id: '67', name: 'Theatre Arts', syllabi: 126174 },
    { id: '9',  name: 'Basic Skills', syllabi: 120316 },
    { id: '19', name: 'Criminal Justice', syllabi: 109400 },
    { id: '48', name: 'Mechanic / Repair Tech', syllabi: 104604 },
    { id: '8',  name: 'Basic Computer Skills', syllabi: 101367 },
    { id: '68', name: 'Theology', syllabi: 94132 },
    { id: '62', name: 'Religion', syllabi: 85590 },
    { id: '23', name: 'Dentistry', syllabi: 77857 },
    { id: '15', name: 'Classics', syllabi: 75448 },
    { id: '55', name: 'Nutrition', syllabi: 71673 },
    { id: '70', name: 'Veterinary Medicine', syllabi: 65788 },
    { id: '71', name: 'Writing', syllabi: 60392 },
    { id: '40', name: 'Japanese', syllabi: 59216 },
    { id: '41', name: 'Journalism', syllabi: 59130 },
    { id: '44', name: 'Library Science', syllabi: 57237 },
    { id: '30', name: 'English as a Second Language', syllabi: 53741 },
    { id: '14', name: 'Chinese', syllabi: 50269 },
    { id: '22', name: 'Dance', syllabi: 48601 },
    { id: '21', name: 'Culinary Arts', syllabi: 47007 },
    { id: '61', name: 'Public Safety', syllabi: 40217 },
    { id: '6',  name: 'Astronomy', syllabi: 36622 },
    { id: '69', name: 'Transportation', syllabi: 35096 },
    { id: '72', name: "Women's Studies", syllabi: 24820 },
    { id: '18', name: 'Cosmetology', syllabi: 24556 },
    { id: '63', name: 'Sign Language', syllabi: 20029 },
    { id: '7',  name: 'Atmospheric Sciences', syllabi: 18819 },
    { id: '4',  name: 'Arabic', syllabi: 17590 },
    { id: '38', name: 'Hebrew', syllabi: 10550 },
    { id: '51', name: 'Military Science', syllabi: 7120 },
  ];

  async function fetchPage(fieldId, offset) {
    const url = `${API}/titles/?field_ids=${fieldId}&size=${PAGE_SIZE}&offset=${offset}`;
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (r.status === 429) { await sleep(2000); return fetchPage(fieldId, offset); }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  function extractItems(data) {
    if (Array.isArray(data)) return data;
    return data.items || data.results || data.data || [];
  }

  function normalizeTitle(item, baseOffset, idx) {
    return {
      rank: item.rank || (baseOffset + idx + 1),
      title: item.title || item.name || '',
      authors: item.authors || item.author || '',
      score: item.score || 0,
      appearances: item.citation_count || item.appearances || item.count || 0,
      year: item.year || item.pub_year || null,
      publisher: item.publisher || null,
    };
  }

  async function crawlField(field) {
    const allTitles = [];
    let offset = 0;
    let page = 0;
    while (true) {
      try {
        const data = await fetchPage(field.id, offset);
        const items = extractItems(data);
        if (!items.length) break;
        for (let i = 0; i < items.length; i++) {
          allTitles.push(normalizeTitle(items[i], offset, i));
        }
        page++;
        if (page % 5 === 0 || items.length < PAGE_SIZE) {
          console.log(`  ${field.name}: page ${page} → ${allTitles.length} titles total`);
        }
        if (items.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
        await sleep(DELAY_MS);
      } catch (e) {
        console.warn(`  !! ${field.name} offset ${offset}: ${e.message}`);
        if (allTitles.length > 0) break; // keep what we have
        await sleep(1000);
        break;
      }
    }
    return allTitles;
  }

  async function fetchGlobalTop() {
    try {
      const r = await fetch(`${API}/titles/?size=${PAGE_SIZE}`, { headers: { 'Accept': 'application/json' } });
      if (!r.ok) return [];
      const data = await r.json();
      return extractItems(data).map((item, i) => normalizeTitle(item, 0, i));
    } catch { return []; }
  }

  // ── ALSO crawl: Authors, Schools, Countries ──────────────────
  async function fetchAllPages(endpoint, label) {
    const all = [];
    let offset = 0;
    while (true) {
      try {
        const r = await fetch(`${API}/${endpoint}/?size=${PAGE_SIZE}&offset=${offset}`, { headers: { 'Accept': 'application/json' } });
        if (!r.ok) break;
        const data = await r.json();
        const items = extractItems(data);
        if (!items.length) break;
        all.push(...items);
        if (items.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
        await sleep(DELAY_MS);
      } catch { break; }
    }
    console.log(`${label}: ${all.length} records`);
    return all;
  }

  // ─────────────────────────────────────────────────────────────
  console.log('=== OSP Full Crawl Starting ===');

  console.log('Fetching global top 200...');
  const globalTop = await fetchGlobalTop();
  console.log('Global top:', globalTop.length);
  await sleep(500);

  console.log('Fetching top authors...');
  const authors = await fetchAllPages('authors', 'Authors');
  await sleep(500);

  console.log('Fetching schools...');
  const schools = await fetchAllPages('schools', 'Schools');
  await sleep(500);

  console.log('Fetching countries...');
  const countries = await fetchAllPages('countries', 'Countries');
  await sleep(500);

  const byField = {};
  let totalTitles = 0;

  for (let i = 0; i < FIELDS.length; i++) {
    const field = FIELDS[i];
    console.log(`\n[${i+1}/${FIELDS.length}] ${field.name} (${field.syllabi.toLocaleString()} syllabi)`);
    const titles = await crawlField(field);
    byField[field.name] = titles;
    totalTitles += titles.length;
    console.log(`  ✓ ${titles.length} titles`);
    await sleep(FIELD_DELAY);
  }

  const result = {
    crawledAt: new Date().toISOString().split('T')[0],
    meta: {
      totalTitles,
      totalSyllabi: FIELDS.reduce((s, f) => s + f.syllabi, 0),
      fields: FIELDS.length,
    },
    fields: FIELDS,
    byField,
    globalTop100: globalTop,
    authors: authors.slice(0, 5000), // top 5000 authors
    schools: schools.slice(0, 3000), // top 3000 schools
    countries,
  };

  console.log('\n=== Crawl Complete ===');
  console.log('Total titles across all fields:', totalTitles);
  console.log('Authors:', result.authors.length);
  console.log('Schools:', result.schools.length);
  console.log('Countries:', result.countries.length);
  console.log('\nDownloading ospData.json...');

  const json = JSON.stringify(result);
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ospData.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  console.log('✓ Done! File size: ~' + (json.length / 1024 / 1024).toFixed(1) + ' MB');
  console.log('Move ospData.json to: C:/Users/prave/Projects/canon/scripts/ospData.json');
  console.log('Then run: node scripts/generate-osp-data.mjs');
})();
