// ============================================================
// ScienceDirect Topics Crawler
// Run this in the browser console while on sciencedirect.com
// It will fetch all topic pages and download the data file.
//
// Usage:
//   1. Open https://www.sciencedirect.com/topics in Chrome
//   2. Open DevTools (F12) → Console tab
//   3. Paste this entire script and press Enter
//   4. Wait ~5-10 minutes for the crawl to complete
//   5. A file "scienceDirectTopics.js" will auto-download
//   6. Move it to: src/constants/scienceDirectTopics.js
// ============================================================

(async () => {
  const SUBJECTS = [
    { name: 'Agricultural and Biological Sciences',                      slug: 'agricultural-and-biological-sciences',                     count: 31545 },
    { name: 'Biochemistry, Genetics and Molecular Biology',              slug: 'biochemistry-genetics-and-molecular-biology',              count: 26572 },
    { name: 'Chemical Engineering',                                      slug: 'chemical-engineering',                                     count:  1386 },
    { name: 'Chemistry',                                                 slug: 'chemistry',                                                count: 19686 },
    { name: 'Computer Science',                                          slug: 'computer-science',                                         count: 27003 },
    { name: 'Earth and Planetary Sciences',                              slug: 'earth-and-planetary-sciences',                             count: 14360 },
    { name: 'Economics, Econometrics and Finance',                       slug: 'economics-econometrics-and-finance',                       count:  2365 },
    { name: 'Engineering',                                               slug: 'engineering',                                              count: 44933 },
    { name: 'Food Science',                                              slug: 'food-science',                                             count:  1402 },
    { name: 'Immunology and Microbiology',                               slug: 'immunology-and-microbiology',                              count: 19959 },
    { name: 'Materials Science',                                         slug: 'materials-science',                                        count:  4239 },
    { name: 'Mathematics',                                               slug: 'mathematics',                                              count: 10030 },
    { name: 'Medicine and Dentistry',                                    slug: 'medicine-and-dentistry',                                   count: 49470 },
    { name: 'Neuroscience',                                              slug: 'neuroscience',                                             count: 18070 },
    { name: 'Nursing and Health Professions',                            slug: 'nursing-and-health-professions',                           count: 22782 },
    { name: 'Pharmacology, Toxicology and Pharmaceutical Science',       slug: 'pharmacology-toxicology-and-pharmaceutical-science',       count: 32632 },
    { name: 'Physics and Astronomy',                                     slug: 'physics-and-astronomy',                                    count:  6554 },
    { name: 'Psychology',                                                slug: 'psychology',                                               count:  4193 },
    { name: 'Social Sciences',                                           slug: 'social-sciences',                                          count: 10105 },
    { name: 'Veterinary Science and Veterinary Medicine',                slug: 'veterinary-science-and-veterinary-medicine',               count:  5788 },
  ];

  const CONCURRENCY = 5;
  const DELAY_MS = 150;

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  function extractTopics(html, subjectSlug) {
    const topics = [];
    // Match all topic links: href="/topics/{subject}/{slug}"
    const re = new RegExp(`href="/topics/${subjectSlug}/([^"]+)"[^>]*>\\s*<span[^>]*>([^<]+)<`, 'g');
    let m;
    while ((m = re.exec(html)) !== null) {
      topics.push({ name: m[2].trim(), slug: m[1] });
    }
    // Deduplicate by slug
    const seen = new Set();
    return topics.filter(t => {
      if (seen.has(t.slug)) return false;
      seen.add(t.slug);
      return true;
    });
  }

  async function fetchPage(subjectSlug, page) {
    const res = await fetch(`/topics/${subjectSlug}?page=${page}`);
    if (!res.ok) return [];
    const html = await res.text();
    return extractTopics(html, subjectSlug);
  }

  async function crawlSubject(subject, onProgress) {
    const totalPages = Math.ceil(subject.count / 50);
    const allTopics = [];
    let fetched = 0;

    // Process in batches of CONCURRENCY
    for (let page = 1; page <= totalPages; page += CONCURRENCY) {
      const batch = [];
      for (let p = page; p < page + CONCURRENCY && p <= totalPages; p++) {
        batch.push(fetchPage(subject.slug, p));
      }
      const results = await Promise.all(batch);
      for (const topics of results) allTopics.push(...topics);
      fetched += batch.length;
      onProgress(subject.name, fetched, totalPages, allTopics.length);
      if (page + CONCURRENCY <= totalPages) await delay(DELAY_MS);
    }
    return allTopics;
  }

  console.log('🚀 ScienceDirect Topics Crawler starting...');
  console.log(`📚 ${SUBJECTS.length} subjects, ~${SUBJECTS.reduce((s,x) => s+x.count,0).toLocaleString()} topics`);

  const topicsBySubject = {};
  let grandTotal = 0;
  const startTime = Date.now();

  for (const subject of SUBJECTS) {
    const totalPages = Math.ceil(subject.count / 50);
    console.log(`\n📂 Crawling: ${subject.name} (${subject.count.toLocaleString()} topics, ${totalPages} pages)`);

    const topics = await crawlSubject(subject, (name, fetched, total, topicCount) => {
      const pct = Math.round((fetched / total) * 100);
      if (fetched % 20 === 0 || fetched === total) {
        console.log(`  ${name}: page ${fetched}/${total} (${pct}%) — ${topicCount} topics extracted`);
      }
    });

    topicsBySubject[subject.slug] = topics;
    grandTotal += topics.length;
    console.log(`  ✅ ${subject.name}: ${topics.length.toLocaleString()} topics`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Crawl complete: ${grandTotal.toLocaleString()} topics in ${elapsed}s`);

  // Generate the JS file content
  const subjectsJson = JSON.stringify(SUBJECTS, null, 2);

  // Build topicsBySubject as compact JS
  const topicsEntries = Object.entries(topicsBySubject)
    .map(([slug, topics]) => {
      const compact = topics.map(t => `{n:${JSON.stringify(t.name)},s:${JSON.stringify(t.slug)}}`).join(',');
      return `  ${JSON.stringify(slug)}:[${compact}]`;
    })
    .join(',\n');

  const crawlDate = new Date().toISOString().slice(0, 10);
  const fileContent = `// ScienceDirect Topics — crawled ${crawlDate}
// ${grandTotal.toLocaleString()} topics across ${SUBJECTS.length} subjects
// Auto-generated by scripts/crawl-sciencedirect-console.js

export const SD_SUBJECTS = ${subjectsJson};

export const SD_TOPICS_BY_SUBJECT = {
${topicsEntries}
};

export const SD_TOTAL = ${grandTotal};
export const SD_CRAWL_DATE = '${crawlDate}';
`;

  // Trigger download
  const blob = new Blob([fileContent], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'scienceDirectTopics.js';
  a.click();
  URL.revokeObjectURL(url);
  console.log('📥 File downloaded: scienceDirectTopics.js');
  console.log('📁 Move it to: src/constants/scienceDirectTopics.js');
})();
