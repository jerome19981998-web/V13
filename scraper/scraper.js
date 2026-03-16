/**
 * CinéMatch — Debug scraper
 * Lance avec: node scraper-debug.js
 * Affiche le HTML brut d'AlloCiné pour trouver les bons sélecteurs
 */

const { chromium } = require('playwright');

async function debug() {
  console.log('🔍 Debug AlloCiné selectors...\n');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: 'fr-FR',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0 Safari/537.36',
  });
  const page = await context.newPage();

  // Test sur UGC Les Halles
  const url = 'https://www.allocine.fr/seance/salle_gen_csalle=C0159.html';
  console.log(`URL: ${url}\n`);

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

  // Attendre un peu que tout charge
  await page.waitForTimeout(3000);

  // ── 1. Lister tous les sélecteurs présents dans la page ──
  const selectors = await page.evaluate(() => {
    const test = [
      // Anciens sélecteurs v4
      'article.card',
      '.card.entity-card',
      '[data-entity-type="movie"]',
      '.showtimes-movie-card',
      // Nouveaux formats possibles
      '[class*="MovieShowtime"]',
      '[class*="movie-card"]',
      '[class*="showtime"]',
      '[class*="Showtime"]',
      '[class*="seance"]',
      '.entity-card',
      '.card--entity',
      // Structure data
      'time[datetime]',
      'button[class*="hour"]',
      // JSON-LD
      'script[type="application/ld+json"]',
      // Liens films
      'a[href*="/film/fichefilm"]',
      'a[href*="/film/"]',
    ];

    return test.map(sel => ({
      selector: sel,
      count: document.querySelectorAll(sel).length,
      // Premier exemple si trouvé
      example: document.querySelector(sel)?.className?.slice(0, 80) || '',
    })).filter(r => r.count > 0);
  });

  console.log('=== SÉLECTEURS PRÉSENTS ===');
  selectors.forEach(({ selector, count, example }) => {
    console.log(`  ${selector}: ${count} éléments`);
    if (example) console.log(`    → class: "${example}"`);
  });

  // ── 2. Extraire les classes des conteneurs principaux ──
  const bodyClasses = await page.evaluate(() => {
    // Chercher tous les éléments avec des classes contenant des mots-clés
    const keywords = ['movie', 'film', 'showtime', 'seance', 'card', 'entity'];
    const found = new Set();
    document.querySelectorAll('*[class]').forEach(el => {
      const cls = el.className;
      if (typeof cls === 'string') {
        keywords.forEach(kw => {
          if (cls.toLowerCase().includes(kw)) found.add(cls.slice(0, 100));
        });
      }
    });
    return [...found].slice(0, 30);
  });

  console.log('\n=== CLASSES AVEC MOT-CLÉ FILM/SÉANCE ===');
  bodyClasses.forEach(c => console.log(`  "${c}"`));

  // ── 3. Chercher les horaires dans le texte ──
  const hourMatches = await page.evaluate(() => {
    const text = document.body.innerText;
    const hours = text.match(/\b\d{1,2}h\d{2}\b/g) || [];
    return [...new Set(hours)].sort();
  });
  console.log(`\n=== HORAIRES TROUVÉS DANS LE TEXTE (${hourMatches.length}) ===`);
  console.log(hourMatches.join(', ') || 'Aucun');

  // ── 4. Chercher les titres de films ──
  const filmLinks = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a[href*="/film/"]')];
    return links
      .map(a => ({ text: a.textContent?.trim(), href: a.href }))
      .filter(l => l.text && l.text.length > 1 && l.text.length < 100)
      .slice(0, 10);
  });
  console.log('\n=== LIENS FILMS ===');
  filmLinks.forEach(({ text, href }) => console.log(`  "${text}" → ${href}`));

  // ── 5. Dump HTML d'un exemple de bloc ──
  const sampleHTML = await page.evaluate(() => {
    // Chercher le premier bloc qui ressemble à un film avec horaires
    const candidates = [
      document.querySelector('[data-entity-type]'),
      document.querySelector('[class*="MovieShowtime"]'),
      document.querySelector('[class*="showtime-bloc"]'),
      document.querySelector('[class*="movie"]'),
      document.querySelector('section[class*="card"]'),
    ].filter(Boolean);

    const el = candidates[0];
    if (!el) return 'Aucun bloc trouvé';
    return el.outerHTML.slice(0, 2000);
  });
  console.log('\n=== HTML PREMIER BLOC ===');
  console.log(sampleHTML.slice(0, 1000));

  // ── 6. Structure JSON-LD si présente ──
  const jsonLD = await page.evaluate(() => {
    const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')];
    return scripts.map(s => {
      try { return JSON.stringify(JSON.parse(s.textContent), null, 2).slice(0, 500); }
      catch { return null; }
    }).filter(Boolean);
  });
  if (jsonLD.length) {
    console.log('\n=== JSON-LD ===');
    jsonLD.forEach((j, i) => console.log(`Script ${i+1}:\n${j}\n`));
  }

  await browser.close();
  console.log('\n✅ Debug terminé');
}

debug().catch(e => { console.error('❌', e); process.exit(1); });
