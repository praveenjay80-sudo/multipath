import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; Canon/1.0)',
  'Accept': 'text/xml,application/xml,*/*',
};

// Parse a course slug like "6-006-introduction-to-algorithms-spring-2020"
function parseSlug(slug) {
  // Course number: dept (letters/digits) + hyphen + num (starts with digit)
  const numMatch = slug.match(/^([a-z0-9]+[a-z]?)-(\d+[a-z]*(?:j|sc|sl|s)?)-(.+)$/i);
  if (!numMatch) return null;

  const [, dept, num, rest] = numMatch;
  const courseNum = `${dept.toUpperCase()}.${num.toUpperCase()}`;

  // Term + year at the end
  const termRx = /-(spring|fall|summer|iap|january|winter)-(\d{4})$/i;
  const yearRx = /-(\d{4})$/;
  let semester = '', year = '', titlePart = rest;

  const termMatch = rest.match(termRx);
  if (termMatch) {
    semester = termMatch[1][0].toUpperCase() + termMatch[1].slice(1).toLowerCase();
    year = termMatch[2];
    titlePart = rest.slice(0, rest.length - termMatch[0].length);
  } else {
    const yearMatch = rest.match(yearRx);
    if (yearMatch) {
      year = yearMatch[1];
      titlePart = rest.slice(0, rest.length - yearMatch[0].length);
    }
  }

  const title = titlePart.split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  // Undergraduate vs Graduate heuristic: num part >= 500 → Graduate
  const numVal = parseInt(num, 10);
  const level = numVal >= 500 ? 'Graduate' : 'Undergraduate';

  return { courseNum, title, semester, year, level };
}

// Extract course-root URLs from a sitemap XML string
function extractCourseUrls(xml) {
  // Match /courses/[one-segment]/ — root pages only, no sub-pages
  return [...xml.matchAll(/<loc>(https?:\/\/ocw\.mit\.edu\/courses\/[^/<]+\/)<\/loc>/g)]
    .map(m => m[1].trim());
}

// Fetch all MIT OCW courses via sitemap
async function timedFetch(url, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { headers: HEADERS, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function loadMITCourses() {
  const sitemapResp = await timedFetch('https://ocw.mit.edu/sitemap.xml', 10000);
  if (!sitemapResp.ok) throw new Error(`sitemap.xml: HTTP ${sitemapResp.status}`);
  const xml = await sitemapResp.text();

  let courseUrls = [];

  if (xml.includes('<sitemapindex')) {
    // Fetch all child sitemaps in parallel
    const childUrls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1].trim());
    const results = await Promise.allSettled(
      childUrls.map(async url => {
        const r = await timedFetch(url, 8000);
        if (!r.ok) return [];
        return extractCourseUrls(await r.text());
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled') courseUrls.push(...r.value);
    }
  } else {
    courseUrls = extractCourseUrls(xml);
  }

  // Deduplicate
  courseUrls = [...new Set(courseUrls)];

  return courseUrls.map(url => {
    const slug = url.replace(/^https?:\/\/ocw\.mit\.edu\/courses\//, '').replace(/\/$/, '');
    const parsed = parseSlug(slug);
    if (!parsed || !parsed.title) return null;
    return {
      id: slug,
      title: parsed.title,
      url,
      course_nums: parsed.courseNum ? [{ coursenum: parsed.courseNum }] : [],
      level: [parsed.level],
      semester: parsed.semester,
      year: parsed.year,
      department_name: '',
      short_description: '',
      instructors: [],
      topics: [],
    };
  }).filter(Boolean);
}

let coursesCache = null;
let cacheTime = 0;
const CACHE_MS = 6 * 60 * 60 * 1000; // 6 hours server-side

app.get('/api/mit-courses', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 200, 500);
  const offset = parseInt(req.query.offset) || 0;

  try {
    if (!coursesCache || Date.now() - cacheTime > CACHE_MS) {
      console.log('Fetching MIT OCW sitemap...');
      coursesCache = await loadMITCourses();
      cacheTime = Date.now();
      console.log(`Loaded ${coursesCache.length} MIT courses from sitemap.`);
    }
    const results = coursesCache.slice(offset, offset + limit);
    res.json({ count: coursesCache.length, results });
  } catch (err) {
    console.error('MIT sitemap error:', err.message);
    res.status(500).json({ error: err.message, count: 0, results: [] });
  }
});

// Scrape a single OCW course page for rich metadata
app.get('/api/mit-course-detail', async (req, res) => {
  const { url } = req.query;
  if (!url || !url.startsWith('https://ocw.mit.edu/courses/')) {
    return res.status(400).json({ error: 'Invalid course URL' });
  }
  try {
    const r = await timedFetch(url, 12000);
    if (!r.ok) return res.status(r.status).json({ error: `HTTP ${r.status}` });
    const html = await r.text();

    // JSON-LD structured data
    let jsonld = {};
    const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
    if (ldMatch) { try { jsonld = JSON.parse(ldMatch[1]); } catch {} }

    // Description — JSON-LD → og:description → meta description
    const ogDesc = (html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i) || [])[1] || '';
    const metaDesc = (html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i) || [])[1] || '';
    const description = (jsonld.description || ogDesc || metaDesc).replace(/\s+/g, ' ').trim();

    // Instructors from JSON-LD or page text
    const rawInstructors = Array.isArray(jsonld.instructor)
      ? jsonld.instructor.map(i => i.name || i).filter(Boolean)
      : typeof jsonld.instructor === 'string' ? [jsonld.instructor] : [];

    // Topics / keywords
    const kwMeta = (html.match(/<meta[^>]+name="keywords"[^>]+content="([^"]+)"/i) || [])[1] || '';
    const keywords = kwMeta ? kwMeta.split(',').map(k => k.trim()).filter(Boolean) : [];

    // Course features (what materials exist: Lecture Notes, Problem Sets, etc.)
    const features = [];
    const featRx = /class="[^"]*course-info-feature-item[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/g;
    for (const m of html.matchAll(featRx)) {
      const text = m[1].replace(/<[^>]+>/g, '').trim();
      if (text) features.push(text);
    }

    // Readings section — look for lists near "Readings" or "Textbook"
    const readings = [];
    const readRx = />([^<]{20,200}(?:by|By)[^<]{5,100})<\//g;
    const readSection = html.slice(
      Math.max(0, html.toLowerCase().indexOf('reading')),
      Math.min(html.length, html.toLowerCase().indexOf('reading') + 8000)
    );
    for (const m of readSection.matchAll(readRx)) {
      const t = m[1].replace(/\s+/g, ' ').trim();
      if (t.length > 20 && t.length < 200) readings.push(t);
      if (readings.length >= 8) break;
    }

    // Level from page — look for "Undergraduate" / "Graduate"
    const levelMatch = html.match(/\b(Undergraduate|Graduate)\b/i);
    const level = levelMatch ? levelMatch[1] : '';

    // Related courses (if listed)
    const related = [];
    const relRx = /\/courses\/([\w-]+)\//g;
    const seen = new Set([url]);
    for (const m of html.matchAll(relRx)) {
      const relUrl = `https://ocw.mit.edu/courses/${m[1]}/`;
      if (!seen.has(relUrl)) { seen.add(relUrl); related.push(relUrl); }
      if (related.length >= 5) break;
    }

    res.json({ description, instructors: rawInstructors, keywords, features, readings, level, related });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Debug endpoint
app.get('/api/mit-test', async (_req, res) => {
  let out = '';
  try {
    const r = await fetch('https://ocw.mit.edu/sitemap.xml', { headers: HEADERS });
    out += `sitemap.xml → HTTP ${r.status}\n`;
    const text = await r.text();
    const isSitemapIndex = text.includes('<sitemapindex');
    out += `Type: ${isSitemapIndex ? 'sitemapindex' : 'urlset'}\n`;
    out += `Course URLs found: ${extractCourseUrls(text).length}\n\n`;
    out += 'First 2000 chars:\n' + text.slice(0, 2000);
  } catch (e) {
    out += `ERROR: ${e.message}`;
  }
  res.type('text').send(out);
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => console.log(`Canon listening on ${PORT}`));
