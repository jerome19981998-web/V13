/**
 * CinéMatch — Scraper v7.1
 * Fix: fermeture popup Didomi (cookies) avant extraction
 */

const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');
const DAYS    = 7;

const SUPA_URL   = process.env.SUPABASE_URL         || 'https://alwfbminhdwinxcozjlj.supabase.co';
const SUPA_KEY   = process.env.SUPABASE_SERVICE_KEY;
const TMDB_TOKEN = process.env.TMDB_TOKEN           || 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIzMzY0M2EwMDRiZGMyYzdlNmIyYTFjOWMzZWI5ZDhlYyIsIm5iZiI6MTc3MzAwMTIzNy42ODYsInN1YiI6IjY5YWRkYTE1MmVmNWMxZmY5NWZjYmNlOCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.bRW2UVqu1p89xPusKV5-mzW4ZeRSk8ij811FWOIwoBM';

const supa = !DRY_RUN && SUPA_KEY ? createClient(SUPA_URL, SUPA_KEY) : null;

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

const sleep = ms => new Promise(r => setTimeout(r, ms));

function toHeure(s) {
  if (!s) return null;
  const m = String(s).match(/(\d{1,2})[h:](\d{2})/i);
  if (!m) return null;
  const h = parseInt(m[1]);
  if (h < 6 || h > 23) return null;
  return `${h}h${m[2]}`;
}

function getDateISO(n = 0) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function slugify(t) {
  return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ── INJECTION CONSENTEMENT DIDOMI (avant chargement page) ────────────────────
// Injecte le consentement dans localStorage AVANT que la page se charge
// → AlloCiné ne montre jamais la popup et charge les séances directement
const DIDOMI_CONSENT_SCRIPT = `
  // Consentement Didomi pré-injecté pour AlloCiné
  try {
    const consent = {
      user_id: 'cinematch-bot',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      vendors: { enabled: [], disabled: [] },
      purposes: { enabled: [], disabled: [] },
      version: 1,
    };
    // Clé utilisée par Didomi sur allocine.fr
    localStorage.setItem('didomi_token', JSON.stringify({ purposes_consent: 'all' }));
    localStorage.setItem('euconsent-v2', 'consent-all');
    localStorage.setItem('didomi-auth', JSON.stringify(consent));
    // Supprimer la classe bloquante sur le body si présente
    document.documentElement.classList.remove('didomi-popup-open');
    document.body && document.body.classList.remove('didomi-popup-open');
    // Masquer la popup visuellement si elle existe
    const popup = document.getElementById('didomi-popup');
    if (popup) popup.style.display = 'none';
    const notice = document.getElementById('didomi-notice');
    if (notice) notice.style.display = 'none';
    // Forcer via API si disponible
    if (window.Didomi) window.Didomi.setUserAgreeToAll();
  } catch(e) {}
`;

async function closeCookiePopup(page) {
  try {
    // Méthode 1 : clic Playwright sur le bouton "Accepter" (déclenche les requêtes réseau)
    const btn = await page.$('#didomi-notice-agree-button, .didomi-components-button--filled, button[aria-label*="accepter" i]');
    if (btn) {
      await btn.click();
      console.log('    🍪 Popup cookies cliquée');
      // Attendre que les horaires se chargent via réseau
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      await sleep(1000);
      return;
    }
    // Méthode 2 : forcer via JS si bouton pas trouvé
    await page.evaluate(() => {
      try {
        if (window.Didomi) { window.Didomi.setUserAgreeToAll(); return; }
        document.documentElement.classList.remove('didomi-popup-open');
      } catch(e) {}
    });
    await sleep(1500);
  } catch (e) {}
}

// ── EXTRACTION DANS LE NAVIGATEUR ────────────────────────────────────────────
async function extractFromPage(page) {
  return page.evaluate(() => {
    const results = [];
    const cards = document.querySelectorAll('.movie-card-theater');

    cards.forEach(card => {
      // Titre
      const titleEl = card.querySelector('a[href*="fichefilm"], .meta-title-link, h2 a, h3 a');
      const title = titleEl?.textContent?.trim();
      if (!title || title.length > 120) return;

      // Durée
      const durationEl = card.querySelector('.meta-body-item, [class*="duration"], [class*="runtime"]');
      const duration = durationEl?.textContent?.trim().match(/\d+h\s*\d+/)?.[0]?.replace(/\s/g, '') || '';

      // Réalisateur
      const dirEl = card.querySelector('[class*="director"], .meta-director');
      const director = dirEl?.textContent?.trim().replace(/^de\s+/i, '') || '';

      // Genre
      const genreEl = card.querySelector('[class*="genre"]');
      const genre = genreEl?.textContent?.trim() || '';

      // Horaires
      const heures = [];

      card.querySelectorAll('.showtimes-hour-item-value').forEach(el => {
        const txt = el.textContent?.trim();
        const m = txt?.match(/(\d{1,2})h(\d{2})/i);
        if (m) { const h = parseInt(m[1]); if (h >= 6 && h <= 23) heures.push(`${h}h${m[2]}`); }
      });

      if (!heures.length) {
        card.querySelectorAll('.showtimes-hour-item').forEach(el => {
          const txt = el.textContent?.trim();
          const m = txt?.match(/(\d{1,2})h(\d{2})/i);
          if (m) { const h = parseInt(m[1]); if (h >= 6 && h <= 23) heures.push(`${h}h${m[2]}`); }
        });
      }

      if (!heures.length) {
        card.querySelectorAll('time[datetime]').forEach(el => {
          const dt = el.getAttribute('datetime') || el.textContent;
          const mISO = dt.match(/T(\d{2}):(\d{2})/);
          if (mISO) { const h = parseInt(mISO[1]); if (h >= 6 && h <= 23) heures.push(`${h}h${mISO[2]}`); }
        });
      }

      if (heures.length > 0) {
        results.push({ title, director, duration, genre, heures: [...new Set(heures)].sort() });
      }
    });

    return results;
  });
}

// ── SCRAPE UN CINÉMA ──────────────────────────────────────────────────────────
async function scrapeCinema(browser, cinemaId, cinema) {
  console.log(`\n📍 ${cinemaId} (${cinema.allocineId})...`);
  const result = { films: {}, seances: {} };

  const context = await browser.newContext({
    locale: 'fr-FR',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0 Safari/537.36',
  });

  // Injecter le consentement Didomi avant chaque chargement de page
  await context.addInitScript(DIDOMI_CONSENT_SCRIPT);

  const page = await context.newPage();

  await page.route('**/*', route => {
    const t = route.request().resourceType();
    if (['image', 'media', 'font'].includes(t)) return route.abort();
    route.continue();
  });

  let availableDates = [];
  try {
    const baseUrl = `https://www.allocine.fr/seance/salle_gen_csalle=${cinema.allocineId}.html`;
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await sleep(2000); // laisser AlloCiné initialiser Didomi
    await page.waitForSelector('.movie-card-theater, .showtimes-list-holder', { timeout: 8000 }).catch(() => {});

    // ── FERMER LA POPUP COOKIES ──
    await closeCookiePopup(page);

    // Lire les dates disponibles
    availableDates = await page.evaluate(() => {
      const section = document.querySelector('[data-showtimes-dates]');
      if (!section) return [];
      try { return JSON.parse(section.getAttribute('data-showtimes-dates') || '[]'); }
      catch { return []; }
    });
    console.log(`  📅 Dates dispo: ${availableDates.slice(0, DAYS).join(', ')}`);

    // Extraire J
    const today = new Date().toISOString().slice(0, 10);
    const seancesJ = await extractFromPage(page);
    for (const { title, director, duration, genre, heures } of seancesJ) {
      if (!result.films[title]) result.films[title] = { title, director, duration, genre };
      if (!result.seances[title]) result.seances[title] = {};
      result.seances[title][today] = heures;
    }
    console.log(`    ✓ ${today}: ${seancesJ.length} films`);
    if (seancesJ[0]) console.log(`      Ex: "${seancesJ[0].title}" → ${seancesJ[0].heures.join(', ')}`);

  } catch (e) {
    console.log(`    ✗ Page J: ${e.message}`);
  }

  // Scraper J+1 à J+6
  const futureDates = availableDates
    .filter(d => d > new Date().toISOString().slice(0, 10))
    .slice(0, DAYS - 1);

  for (const dateISO of futureDates) {
    try {
      const url = `https://www.allocine.fr/seance/salle_gen_csalle=${cinema.allocineId}.html?date=${dateISO}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForSelector('.movie-card-theater', { timeout: 6000 }).catch(() => {});

      // ── FERMER LA POPUP COOKIES (si elle réapparaît) ──
      await closeCookiePopup(page);

      const seances = await extractFromPage(page);
      for (const { title, director, duration, genre, heures } of seances) {
        if (!result.films[title]) result.films[title] = { title, director, duration, genre };
        if (!result.seances[title]) result.seances[title] = {};
        result.seances[title][dateISO] = heures;
      }
      console.log(`    ✓ ${dateISO}: ${seances.length} films`);

    } catch (e) {
      console.log(`    ✗ ${dateISO}: ${e.message}`);
    }
    await sleep(800);
  }

  await context.close();
  return result;
}

// ── TMDB ──────────────────────────────────────────────────────────────────────
const TMDB_GENRES = { 28:'Action',12:'Aventure',16:'Animation',35:'Comédie',80:'Polar',99:'Documentaire',18:'Drame',14:'Fantastique',27:'Horreur',10749:'Romance',878:'Sci-Fi',53:'Thriller',10752:'Guerre',36:'Biopic' };

async function searchTMDB(title, year) {
  const p = new URLSearchParams({ query: title, language: 'fr-FR', region: 'FR' });
  if (year) p.set('primary_release_year', String(year));
  const res = await fetch(`https://api.themoviedb.org/3/search/movie?${p}`, {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}` }
  });
  if (!res.ok) return null;
  const { results } = await res.json();
  return results?.[0] || null;
}

async function enrichWithTMDB(films) {
  console.log('\n🎬 Enrichissement TMDB...');
  const year = new Date().getFullYear();
  for (const film of Object.values(films)) {
    try {
      const movie = await searchTMDB(film.title, year)
                 || await searchTMDB(film.title, year - 1)
                 || await searchTMDB(film.title, null);
      if (!movie) { console.log(`  ✗ "${film.title}"`); continue; }

      film.tmdbId   = movie.id;
      film.poster   = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null;
      film.tmdbNote = movie.vote_average ? +movie.vote_average.toFixed(1) : null;
      film.synopsis = movie.overview || '';
      if (!film.genre && movie.genre_ids?.[0]) film.genre = TMDB_GENRES[movie.genre_ids[0]] || '';

      const vr = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}/videos?language=fr-FR`, {
        headers: { Authorization: `Bearer ${TMDB_TOKEN}` }
      });
      if (vr.ok) {
        const { results: vids } = await vr.json();
        const t = vids?.find(v => v.type==='Trailer'&&v.site==='YouTube') || vids?.find(v => v.site==='YouTube');
        if (t) film.trailerKey = t.key;
      }

      console.log(`  ✓ "${film.title}" → ${movie.id} (${movie.release_date?.slice(0,4)})${film.trailerKey?' + 🎬':''}`);
      await sleep(200);
    } catch (e) { console.log(`  ✗ "${film.title}": ${e.message}`); }
  }
}

// ── SUPABASE ──────────────────────────────────────────────────────────────────
async function pushToSupabase(allData) {
  console.log('\n📤 Push Supabase...');

  await supa.from('cinemas_dyn').upsert(
    Object.entries(CINEMAS).map(([id,c]) => ({
      id, name:c.name, chain:c.chain, lat:c.lat, lng:c.lng,
      addr:c.addr, metro:c.metro, salles:c.salles,
    })), { onConflict: 'id' }
  );

  const allFilms = {};
  for (const { films } of Object.values(allData)) {
    for (const [title, f] of Object.entries(films)) {
      const slug = slugify(title);
      if (!allFilms[slug]) allFilms[slug] = { ...f, slug };
    }
  }
  await enrichWithTMDB(allFilms);

  for (let i = 0; i < Object.keys(allFilms).length; i += 50) {
    const chunk = Object.entries(allFilms).slice(i, i + 50);
    await supa.from('films_dyn').upsert(
      chunk.map(([slug,f]) => ({
        id: slug, title:f.title, director:f.director||'', duration:f.duration||'',
        genre:f.genre||'', synopsis:f.synopsis||'', poster_url:f.poster||null,
        tmdb_id:f.tmdbId||null, tmdb_note:f.tmdbNote||null, trailer_key:f.trailerKey||null,
        updated_at: new Date().toISOString(),
      })), { onConflict: 'id' }
    );
  }
  console.log(`  ✓ ${Object.keys(allFilms).length} films`);

  await supa.from('seances_dyn').delete().lt('date', getDateISO(0));
  const rows = [];
  for (const [cinemaId, { seances }] of Object.entries(allData)) {
    for (const [title, dateMap] of Object.entries(seances)) {
      const slug = slugify(title);
      for (const [date, heures] of Object.entries(dateMap)) {
        if (heures.length) rows.push({ cinema_id:cinemaId, film_id:slug, date, heures });
      }
    }
  }
  for (let i = 0; i < rows.length; i += 100) {
    await supa.from('seances_dyn').upsert(rows.slice(i,i+100), { onConflict:'cinema_id,film_id,date' });
  }
  console.log(`  ✓ ${rows.length} séances`);
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🎬 CinéMatch Scraper v7.1 — ' + new Date().toLocaleString('fr-FR'));
  console.log(DRY_RUN ? '🔍 DRY-RUN' : '🚀 PRODUCTION');

  const browser = await chromium.launch({ headless: true });
  const allData = {};

  for (const [id, cinema] of Object.entries(CINEMAS)) {
    try {
      allData[id] = await scrapeCinema(browser, id, cinema);
    } catch (e) {
      console.error(`❌ ${id}:`, e.message);
      allData[id] = { films:{}, seances:{} };
    }
    const nf = Object.keys(allData[id].films).length;
    const ns = Object.values(allData[id].seances).reduce((s,d)=>s+Object.values(d).reduce((a,h)=>a+h.length,0),0);
    console.log(`  ${nf>0?'✓':'✗'} ${id}: ${nf} films, ${ns} séances`);
    await sleep(600);
  }

  await browser.close();

  const totalFilms = new Set(Object.values(allData).flatMap(d=>Object.keys(d.films)));
  const totalSeances = Object.values(allData).reduce((s,d)=>s+Object.values(d.seances).reduce((a,dm)=>a+Object.values(dm).reduce((b,h)=>b+h.length,0),0),0);
  console.log(`\n📊 TOTAL: ${totalFilms.size} films, ${totalSeances} séances`);

  if (DRY_RUN) {
    const ex = Object.entries(allData).find(([,d])=>Object.keys(d.seances).length>0);
    if (ex) {
      console.log(`\n🔍 Exemple (${ex[0]}):`);
      Object.entries(ex[1].seances).slice(0,3).forEach(([t,dates])=>{
        console.log(`  "${t}":`);
        Object.entries(dates).forEach(([d,h])=>console.log(`    ${d}: ${h.join(', ')}`));
      });
    }
    return;
  }

  if (!SUPA_KEY) { console.error('❌ SUPABASE_SERVICE_KEY manquante'); process.exit(1); }
  await pushToSupabase(allData);
  console.log('\n✅ Terminé !');
}

main().catch(e => { console.error('❌ Fatal:', e); process.exit(1); });
