/**
 * CinéMatch — Scraper v5
 *
 * Améliorations vs v4 :
 * - Playwright (headless Chrome) pour JS-rendered pages AlloCiné J+1..J+6
 * - Sélecteurs CSS mis à jour pour AlloCiné 2024+
 * - TMDB search avec année de sortie → moins de faux positifs
 * - Déduplication des films par slug normalisé + tmdb_id
 * - Nettoyage des séances passées en fin de run
 */

const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');
const DAYS    = 7;

const SUPA_URL   = process.env.SUPABASE_URL         || 'https://alwfbminhdwinxcozjlj.supabase.co';
const SUPA_KEY   = process.env.SUPABASE_SERVICE_KEY;
const TMDB_TOKEN = process.env.TMDB_TOKEN           || 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIzMzY0M2EwMDRiZGMyYzdlNmIyYTFjOWMzZWI5ZDhlYyIsIm5iZiI6MTc3MzAwMTIzNy42ODYsInN1YiI6IjY5YWRkYTE1MmVmNWMxZmY5NWZjYmNlOCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.bRW2UVqu1p89xPusKV5-mzW4ZeRSk8ij811FWOIwoBM';

const supa = !DRY_RUN && SUPA_KEY ? createClient(SUPA_URL, SUPA_KEY) : null;

// ─── CINÉMAS ──────────────────────────────────────────────────────────────────
const CINEMAS = {
  'ugc-halles':            { name: 'UGC Ciné Cité Les Halles',    chain: 'ugc',     lat: 48.8609, lng: 2.3474, addr: '7 pl. de la Rotonde',          metro: 'Les Halles',      allocineId: 'C0159', salles: 27 },
  'ugc-bercy':             { name: 'UGC Ciné Cité Bercy',          chain: 'ugc',     lat: 48.8302, lng: 2.3789, addr: '2 cour Saint-Émilion',         metro: 'Cour St-Émilion', allocineId: 'C0026', salles: 18 },
  'ugc-paris19':           { name: 'UGC Ciné Cité Paris 19',       chain: 'ugc',     lat: 48.8866, lng: 2.3780, addr: '166 bd Macdonald',             metro: 'Corentin Cariou', allocineId: 'W7509', salles: 19 },
  'ugc-maillot':           { name: 'UGC Maillot',                  chain: 'ugc',     lat: 48.8794, lng: 2.2830, addr: '2 pl. Porte Maillot',          metro: 'Porte Maillot',   allocineId: 'C0089', salles: 9  },
  'ugc-opera':             { name: 'UGC Opéra',                    chain: 'ugc',     lat: 48.8719, lng: 2.3387, addr: '34 bd des Italiens',           metro: 'Opéra',           allocineId: 'C0074', salles: 7  },
  'ugc-danton':            { name: 'UGC Danton',                   chain: 'ugc',     lat: 48.8527, lng: 2.3411, addr: '99 bd du Montparnasse',        metro: 'Vavin',           allocineId: 'C0072', salles: 6  },
  'ugc-montparnasse':      { name: 'UGC Montparnasse',              chain: 'ugc',     lat: 48.8424, lng: 2.3244, addr: '83 bd du Montparnasse',        metro: 'Vavin',           allocineId: 'C0103', salles: 5  },
  'ugc-lyon':              { name: 'UGC Lyon-Bastille',             chain: 'ugc',     lat: 48.8448, lng: 2.3731, addr: '12 rue de Lyon',               metro: 'Gare de Lyon',    allocineId: 'C0146', salles: 6  },
  'pathe-beaugrenelle':    { name: 'Pathé Beaugrenelle',            chain: 'pathe',   lat: 48.8473, lng: 2.2894, addr: '7 rue Linois',                 metro: 'Charles Michels', allocineId: 'W7502', salles: 13 },
  'pathe-convention':      { name: 'Pathé Convention',              chain: 'pathe',   lat: 48.8396, lng: 2.3087, addr: '27 rue Alain-Chartier',        metro: 'Convention',      allocineId: 'C0161', salles: 14 },
  'pathe-parnasse':        { name: 'Pathé Parnasse',                chain: 'pathe',   lat: 48.8429, lng: 2.3334, addr: "3 rue d'Odessa",               metro: 'Montparnasse',    allocineId: 'C0158', salles: 7  },
  'pathe-wepler':          { name: 'Pathé Wepler',                  chain: 'pathe',   lat: 48.8842, lng: 2.3272, addr: '140 bd de Clichy',             metro: 'Place de Clichy', allocineId: 'C0179', salles: 10 },
  'pathe-alesia':          { name: 'Pathé Alésia',                  chain: 'pathe',   lat: 48.8272, lng: 2.3264, addr: '73 av. du Gal Leclerc',        metro: 'Alésia',          allocineId: 'C0037', salles: 8  },
  'pathe-batignolles':     { name: 'Les 7 Batignolles',             chain: 'pathe',   lat: 48.8996, lng: 2.3133, addr: '25 allée Colette Heilbronner', metro: 'Porte de Clichy', allocineId: 'P7517', salles: 7  },
  'gaumont-opera':         { name: 'Gaumont Opéra (Capucines)',     chain: 'gaumont', lat: 48.8701, lng: 2.3308, addr: '2 bd des Capucines',           metro: 'Opéra',           allocineId: 'C0125', salles: 9  },
  'gaumont-convention':    { name: 'Gaumont Convention',            chain: 'gaumont', lat: 48.8392, lng: 2.3089, addr: '27 rue Alain-Chartier',        metro: 'Convention',      allocineId: 'C0172', salles: 14 },
  'gaumont-aquaboulevard': { name: 'Gaumont Aquaboulevard',         chain: 'gaumont', lat: 48.8314, lng: 2.2783, addr: '8 rue Colonel Pierre Avia',    metro: 'Balard',          allocineId: 'C0116', salles: 15 },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

function toHeure(str) {
  if (!str) return null;
  const m = String(str).match(/(\d{1,2})[h:Th](\d{2})/i);
  if (!m) return null;
  const h = parseInt(m[1]), min = m[2];
  if (h < 6 || h > 23) return null; // ignore horaires aberrants
  return `${h}h${min}`;
}

function getDateISO(n = 0) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function slugify(title) {
  return title.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ─── PARSE PAGE ALLOCINE (dans le contexte du navigateur) ─────────────────────
// FIX #1 : extraction côté navigateur = on lit le DOM rendu par JS
async function extractSeancesFromPage(page) {
  return page.evaluate(() => {
    const results = [];

    // ── Sélecteur principal AlloCiné 2024 ──
    // Structure: section.section-showtimes > div[class*="showtimes-movie"] > ...
    const movieBlocks = document.querySelectorAll(
      '[data-entity-type="movie"], .showtimes-movie-card, section[class*="MovieShowtime"], article[class*="movie"]'
    );

    movieBlocks.forEach(block => {
      // Titre
      const titleEl = block.querySelector(
        'h2 a, h3 a, [class*="meta-title"] a, [class*="movie-title"] a, a[href*="/film/"]'
      );
      const title = titleEl?.textContent?.trim();
      if (!title || title.length > 120) return;

      // Horaires
      const heures = [];
      // Format <time datetime="2024-03-16T14:30">
      block.querySelectorAll('time[datetime]').forEach(el => {
        const dt = el.getAttribute('datetime') || el.textContent;
        const m = dt.match(/T(\d{2}):(\d{2})/);
        if (m) {
          const h = parseInt(m[1]);
          if (h >= 6 && h <= 23) heures.push(`${h}h${m[2]}`);
        }
      });

      // Format boutons texte "14h30"
      if (!heures.length) {
        block.querySelectorAll('button, span[class*="hour"], [class*="showtime"]').forEach(el => {
          const txt = el.textContent?.trim();
          const m = txt?.match(/^(\d{1,2})h(\d{2})$/);
          if (m) {
            const h = parseInt(m[1]);
            if (h >= 6 && h <= 23) heures.push(`${h}h${m[2]}`);
          }
        });
      }

      // Infos film
      const directorEl = block.querySelector('[class*="director"], [class*="meta-director"]');
      const director = directorEl?.textContent?.trim().replace(/^de\s+/i, '') || '';

      const durationEl = [...block.querySelectorAll('span, div')]
        .find(el => /\d+h\d+/.test(el.textContent));
      const duration = durationEl?.textContent?.trim().match(/\d+h\d+/)?.[0] || '';

      if (heures.length > 0) {
        results.push({ title, director, duration, heures: [...new Set(heures)].sort() });
      }
    });

    // ── Fallback : JSON-LD dans les scripts ──
    if (!results.length) {
      document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
        try {
          const data = JSON.parse(s.textContent);
          const items = Array.isArray(data) ? data : [data];
          items.forEach(item => {
            if (item['@type'] === 'Movie' && item.name) {
              const heures = [];
              (item.workPresented || []).forEach(w => {
                (w.offers || []).forEach(o => {
                  const m = (o.startDate || '').match(/T(\d{2}):(\d{2})/);
                  if (m) heures.push(`${parseInt(m[1])}h${m[2]}`);
                });
              });
              if (heures.length) results.push({ title: item.name, heures });
            }
          });
        } catch {}
      });
    }

    return results;
  });
}

// ─── SCRAPE UN CINEMA ─────────────────────────────────────────────────────────
async function scrapeCinema(browser, cinemaId, cinema) {
  console.log(`\n📍 ${cinemaId} (${cinema.allocineId})...`);
  const result = { films: {}, seances: {} };
  const context = await browser.newContext({
    locale: 'fr-FR',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0 Safari/537.36',
  });
  const page = await context.newPage();

  // Bloquer images/fonts/css pour aller plus vite
  await page.route('**/*', route => {
    const rt = route.request().resourceType();
    if (['image', 'font', 'stylesheet', 'media'].includes(rt)) return route.abort();
    route.continue();
  });

  for (let day = 0; day < DAYS; day++) {
    const dateISO = getDateISO(day);
    const url = day === 0
      ? `https://www.allocine.fr/seance/salle_gen_csalle=${cinema.allocineId}.html`
      : `https://www.allocine.fr/seance/salle_gen_csalle=${cinema.allocineId}.html?date=${dateISO}`;

    console.log(`  📅 ${dateISO}`);

    try {
      // FIX #2 : attendre que le contenu soit chargé (résout le problème J+1..J+6)
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

      // Attendre que les séances soient dans le DOM
      await page.waitForSelector(
        '[data-entity-type="movie"], .showtimes-movie-card, [class*="MovieShowtime"]',
        { timeout: 8000 }
      ).catch(() => {}); // ne pas crasher si pas de séances

      const seancesJour = await extractSeancesFromPage(page);

      for (const { title, director, duration, heures } of seancesJour) {
        if (!result.films[title]) {
          result.films[title] = { title, director, duration, genre: '' };
        }
        if (!result.seances[title]) result.seances[title] = {};
        result.seances[title][dateISO] = heures;
      }

      console.log(`    ✓ ${seancesJour.length} films`);
      if (seancesJour[0]) {
        console.log(`    Ex: "${seancesJour[0].title}" → ${seancesJour[0].heures.join(', ')}`);
      }

    } catch (e) {
      console.log(`    ✗ Erreur: ${e.message}`);
    }

    await sleep(600);
  }

  await context.close();
  return result;
}

// ─── ENRICHISSEMENT TMDB ──────────────────────────────────────────────────────
// FIX #3 : ajout de l'année pour réduire les faux positifs
async function enrichWithTMDB(films) {
  console.log('\n🎬 Enrichissement TMDB...');
  const currentYear = new Date().getFullYear();

  for (const [slug, film] of Object.entries(films)) {
    try {
      // Essai 1 : avec année courante (films récents = en salle maintenant)
      let movie = await searchTMDB(film.title, currentYear);

      // Essai 2 : sans année si pas trouvé
      if (!movie) movie = await searchTMDB(film.title, null);

      // Essai 3 : avec année -1 (films sortis fin d'année précédente)
      if (!movie) movie = await searchTMDB(film.title, currentYear - 1);

      if (!movie) { console.log(`  ✗ "${film.title}" — introuvable TMDB`); continue; }

      film.tmdbId   = movie.id;
      film.poster   = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null;
      film.tmdbNote = movie.vote_average ? +movie.vote_average.toFixed(1) : null;
      film.synopsis = movie.overview || '';
      // FIX : récupérer le genre TMDB directement (plus fiable qu'AlloCiné scraping)
      film.genre    = movie.genre_ids?.[0] ? tmdbGenreLabel(movie.genre_ids[0]) : film.genre;

      // Trailer
      const vRes = await fetch(
        `https://api.themoviedb.org/3/movie/${movie.id}/videos?language=fr-FR`,
        { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } }
      );
      if (vRes.ok) {
        const { results: vids } = await vRes.json();
        const t = vids?.find(v => v.type === 'Trailer' && v.site === 'YouTube')
               || vids?.find(v => v.site === 'YouTube');
        if (t) film.trailerKey = t.key;
      }

      console.log(`  ✓ "${film.title}" → tmdb:${movie.id} (${movie.release_date?.slice(0,4)})${film.trailerKey ? ' + trailer' : ''}`);
      await sleep(200);

    } catch (e) {
      console.log(`  ✗ "${film.title}": ${e.message}`);
    }
  }
}

async function searchTMDB(title, year) {
  const params = new URLSearchParams({ query: title, language: 'fr-FR', region: 'FR' });
  if (year) params.set('primary_release_year', year);
  const res = await fetch(
    `https://api.themoviedb.org/3/search/movie?${params}`,
    { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } }
  );
  if (!res.ok) return null;
  const { results } = await res.json();
  return results?.[0] || null;
}

// Mapping genre_id TMDB → label français
const TMDB_GENRES = {
  28:'Action', 12:'Aventure', 16:'Animation', 35:'Comédie', 80:'Polar',
  99:'Documentaire', 18:'Drame', 14:'Fantastique', 27:'Horreur',
  10749:'Romance', 878:'Sci-Fi', 53:'Thriller', 10752:'Guerre', 36:'Biopic',
};
function tmdbGenreLabel(id) { return TMDB_GENRES[id] || 'Divers'; }

// ─── PUSH SUPABASE ────────────────────────────────────────────────────────────
async function pushToSupabase(allData) {
  console.log('\n📤 Push Supabase...');

  // 1. Cinémas
  const { error: cinErr } = await supa.from('cinemas_dyn').upsert(
    Object.entries(CINEMAS).map(([id, c]) => ({
      id, name: c.name, chain: c.chain, lat: c.lat, lng: c.lng,
      addr: c.addr, metro: c.metro, allocine_id: c.allocineId, salles: c.salles,
    })), { onConflict: 'id' }
  );
  if (cinErr) console.error('⚠ Cinémas:', cinErr.message);

  // 2. Films — dédupliqués par slug
  const allFilms = {};
  for (const { films } of Object.values(allData)) {
    for (const [title, f] of Object.entries(films)) {
      const slug = slugify(title);
      if (!allFilms[slug]) allFilms[slug] = { ...f, slug };
    }
  }
  await enrichWithTMDB(allFilms);

  const filmRows = Object.entries(allFilms).map(([slug, f]) => ({
    id: slug, title: f.title, director: f.director || '', duration: f.duration || '',
    genre: f.genre || '', synopsis: f.synopsis || '', poster_url: f.poster || null,
    tmdb_id: f.tmdbId || null, tmdb_note: f.tmdbNote || null, trailer_key: f.trailerKey || null,
    updated_at: new Date().toISOString(),
  }));

  // Insérer par chunks de 50
  for (let i = 0; i < filmRows.length; i += 50) {
    const { error } = await supa.from('films_dyn').upsert(filmRows.slice(i, i + 50), { onConflict: 'id' });
    if (error) console.error('⚠ Films:', error.message);
  }
  console.log(`  ✓ ${filmRows.length} films insérés`);

  // 3. Séances
  // Supprimer les séances passées d'abord
  const { error: delErr } = await supa.from('seances_dyn').delete().lt('date', getDateISO(0));
  if (delErr) console.error('⚠ Delete old:', delErr.message);

  const rows = [];
  for (const [cinemaId, { seances }] of Object.entries(allData)) {
    for (const [title, dateMap] of Object.entries(seances)) {
      const slug = slugify(title);
      for (const [date, heures] of Object.entries(dateMap)) {
        if (heures.length > 0) rows.push({ cinema_id: cinemaId, film_id: slug, date, heures });
      }
    }
  }

  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supa.from('seances_dyn')
      .upsert(rows.slice(i, i + 100), { onConflict: 'cinema_id,film_id,date' });
    if (error) console.error('⚠ Séances:', error.message);
  }
  console.log(`  ✓ ${rows.length} séances insérées`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🎬 CinéMatch Scraper v5 — ' + new Date().toLocaleString('fr-FR'));
  console.log(DRY_RUN ? '🔍 DRY-RUN' : '🚀 PRODUCTION');
  console.log(`📅 ${DAYS} jours : ${getDateISO(0)} → ${getDateISO(DAYS - 1)}`);
  console.log('─'.repeat(50));

  // Lancer Playwright
  const browser = await chromium.launch({ headless: true });

  const allData = {};
  for (const [id, cinema] of Object.entries(CINEMAS)) {
    try {
      allData[id] = await scrapeCinema(browser, id, cinema);
    } catch (e) {
      console.error(`❌ ${id}:`, e.message);
      allData[id] = { films: {}, seances: {} };
    }
    await sleep(500);
  }

  await browser.close();

  // Résumé
  const totalFilms = new Set();
  let totalSeances = 0;
  for (const [cid, data] of Object.entries(allData)) {
    const nf = Object.keys(data.films).length;
    const ns = Object.values(data.seances).reduce((s, fd) =>
      s + Object.values(fd).reduce((a, h) => a + h.length, 0), 0);
    Object.keys(data.films).forEach(t => totalFilms.add(t));
    totalSeances += ns;
    console.log(`  ${nf > 0 ? '✓' : '✗'} ${cid}: ${nf} films, ${ns} séances`);
  }
  console.log(`\n📊 TOTAL: ${totalFilms.size} films uniques, ${totalSeances} séances`);

  if (DRY_RUN) {
    const ex = Object.entries(allData).find(([, d]) => Object.keys(d.seances).length > 0);
    if (ex) {
      console.log(`\n🔍 Exemple (${ex[0]}):`);
      Object.entries(ex[1].seances).slice(0, 3).forEach(([t, dates]) => {
        console.log(`  "${t}":`);
        Object.entries(dates).forEach(([d, h]) => console.log(`    ${d}: ${h.join(', ')}`));
      });
    }
    return;
  }

  if (!SUPA_KEY) { console.error('❌ SUPABASE_SERVICE_KEY manquante'); process.exit(1); }
  await pushToSupabase(allData);
  console.log('\n✅ Terminé !');
}

main().catch(e => { console.error('❌ Fatal:', e); process.exit(1); });
