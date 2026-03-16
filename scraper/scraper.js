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

// ── BYPASS DIDOMI COMPLET ────────────────────────────────────────────────────
// On remplace l'objet window.Didomi par un faux qui retourne toujours "consenti"
// avant même que le SDK Didomi se charge → AlloCiné pense que l'utilisateur
// a déjà tout accepté et charge les séances directement
const DIDOMI_CONSENT_SCRIPT = `
  (function() {
    // Stocker le consentement dans localStorage (lu par Didomi au démarrage)
    try {
      localStorage.setItem('didomi_token', JSON.stringify({
        purposes_consent: 'all', vendors_consent: 'all',
        created: new Date().toISOString(), updated: new Date().toISOString()
      }));
      localStorage.setItem('euconsent-v2', 'CPAAAAAAAAAAAAAAAAAAAAEgAAAAAAAAAAAA');
    } catch(e) {}

    // Créer un faux objet Didomi qui répond "tout accepté" à toutes les questions
    const fakeDidomi = {
      setUserAgreeToAll: function() {},
      setUserDisagreeToAll: function() {},
      getUserConsentStatusForPurpose: function() { return true; },
      getUserConsentStatusForVendor: function() { return true; },
      getUserStatus: function() { return { purposes: { consent: { enabled: [] } } }; },
      isReady: function() { return true; },
      on: function(event, cb) { if (event === 'ready') { try { cb(); } catch(e) {} } return function(){}; },
      off: function() {},
      notice: { isVisible: function() { return false; } },
      preferences: {},
    };

    // Injecter avant que le vrai Didomi se charge
    if (!window.Didomi) window.Didomi = fakeDidomi;

    // Intercepter la définition de window.Didomi pour garder notre faux
    Object.defineProperty(window, 'Didomi', {
      get: function() { return fakeDidomi; },
      set: function(v) {
        // Le vrai SDK essaie de se définir — on ignore et on garde le faux
      },
      configurable: true,
    });

    // Supprimer la classe bloquante dès que le DOM est prêt
    function removeBlockingClass() {
      document.documentElement.classList.remove('didomi-popup-open');
      document.body && document.body.classList.remove('didomi-popup-open');
    }
    removeBlockingClass();
    document.addEventListener('DOMContentLoaded', removeBlockingClass);
  })();
`;

async function closeCookiePopup(page) {
  // Avec le faux Didomi injecté via addInitScript, la popup ne devrait plus bloquer.
  // On supprime quand même la classe au cas où AlloCiné la remet après coup.
  try {
    await page.evaluate(() => {
      document.documentElement.classList.remove('didomi-popup-open');
      document.body && document.body.classList.remove('didomi-popup-open');
      const popup = document.getElementById('didomi-popup');
      if (popup) popup.style.display = 'none';
    });
    await sleep(500);
  } catch(e) {}
}

// ── EXTRACTION PAR INTERCEPTION RÉSEAU ───────────────────────────────────────
// AlloCiné charge les séances via des requêtes XHR/fetch → on les intercepte
function parseShowtimeResponse(json, dateISO) {
  const results = [];
  try {
    // Format 1: { results: [ { movie: { title }, showtimes: [...] } ] }
    const items = json?.results || json?.data || json?.showtimes || json?.movies || [];
    const list = Array.isArray(items) ? items : Object.values(items);
    for (const item of list) {
      const title = item?.movie?.title || item?.title || item?.name;
      if (!title) continue;
      const times = item?.showtimes || item?.shows || item?.sessions || [];
      const timeList = Array.isArray(times) ? times : Object.values(times);
      const heures = [];
      for (const t of timeList) {
        const raw = t?.startsAt || t?.startAt || t?.time || t?.startTime || t?.datetime || t;
        const h = toHeure(String(raw));
        if (h) heures.push(h);
      }
      if (heures.length) results.push({ title, director: item?.movie?.directors?.[0]?.name || '', duration: '', genre: '', heures: [...new Set(heures)].sort() });
    }
  } catch(e) {}
  return results;
}

// ── SCRAPE UN CINÉMA ──────────────────────────────────────────────────────────
async function scrapeCinema(browser, cinemaId, cinema) {
  console.log(`\n📍 ${cinemaId} (${cinema.allocineId})...`);
  const result = { films: {}, seances: {} };

  const context = await browser.newContext({
    locale: 'fr-FR',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0 Safari/537.36',
  });

  // Injecter le faux Didomi avant chaque page
  await context.addInitScript(DIDOMI_CONSENT_SCRIPT);

  const page = await context.newPage();

  // Collecter toutes les réponses JSON qui ressemblent à des séances
  const capturedData = {}; // { dateISO: [seances] }

  page.on('response', async response => {
    const url = response.url();
    // Cibler les requêtes API de séances d'AlloCiné
    if (!url.includes('allocine') && !url.includes('acsta')) return;
    if (response.status() !== 200) return;
    const ct = response.headers()['content-type'] || '';
    if (!ct.includes('json')) return;
    try {
      const json = await response.json().catch(() => null);
      if (!json) return;
      // Chercher une date dans l'URL
      const dateMatch = url.match(/(\d{4}-\d{2}-\d{2})/);
      const dateISO = dateMatch ? dateMatch[1] : getDateISO(0);
      const seances = parseShowtimeResponse(json, dateISO);
      if (seances.length > 0) {
        console.log(`    📡 API interceptée: ${seances.length} films pour ${dateISO}`);
        if (!capturedData[dateISO]) capturedData[dateISO] = [];
        capturedData[dateISO].push(...seances);
      }
    } catch(e) {}
  });

  // Bloquer images/media, et REMPLACER le script Didomi par notre version
  await page.route('**/*', async route => {
    const url = route.request().url();
    const t = route.request().resourceType();
    // Intercepter le SDK Didomi et le remplacer par un stub qui consent immédiatement
    if (url.includes('didomi') || url.includes('sdk.privacy-center')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `
          window.didomiOnReady = window.didomiOnReady || [];
          window.Didomi = {
            setUserAgreeToAll: function() {},
            getUserConsentStatusForPurpose: function() { return true; },
            getUserConsentStatusForVendor: function() { return true; },
            isReady: function() { return true; },
            on: function(e, cb) { if(e==='ready') setTimeout(cb, 0); return function(){}; },
            off: function() {},
            notice: { isVisible: function() { return false; } },
          };
          // Déclencher les callbacks didomiOnReady
          (window.didomiOnReady || []).forEach(function(cb) { try { cb(window.Didomi); } catch(e) {} });
          // Déclencher l'événement consent
          document.dispatchEvent(new CustomEvent('didomi:consent', { detail: { status: 'agreed' } }));
        `,
      });
      return;
    }
    if (['image', 'media', 'font', 'stylesheet'].includes(t)) return route.abort();
    route.continue();
  });

  // Récupérer les dates dispo depuis la page J
  let availableDates = [];
  try {
    const baseUrl = `https://www.allocine.fr/seance/salle_gen_csalle=${cinema.allocineId}.html`;
    await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(3000); // attendre que les séances se chargent post-consentement

    availableDates = await page.evaluate(() => {
      const section = document.querySelector('[data-showtimes-dates]');
      if (!section) return [];
      try { return JSON.parse(section.getAttribute('data-showtimes-dates') || '[]'); }
      catch { return []; }
    });
    console.log(`  📅 Dates dispo: ${availableDates.slice(0, DAYS).join(', ')}`);

    // Essayer aussi extraction DOM classique (si les horaires sont dans le HTML)
    const today = getDateISO(0);
    const domSeances = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('.movie-card-theater').forEach(card => {
        const titleEl = card.querySelector('a[href*="fichefilm"], .meta-title-link, h2 a');
        const title = titleEl?.textContent?.trim();
        if (!title || title.length > 120) return;
        const heures = [];
        card.querySelectorAll('.showtimes-hour-item-value, .showtimes-hour-item').forEach(el => {
          const m = el.textContent?.trim().match(/(\d{1,2})h(\d{2})/i);
          if (m) { const h = parseInt(m[1]); if (h >= 6 && h <= 23) heures.push(`${h}h${m[2]}`); }
        });
        if (heures.length) results.push({ title, director: '', duration: '', genre: '', heures: [...new Set(heures)].sort() });
      });
      return results;
    });
    if (domSeances.length) {
      console.log(`    ✓ DOM ${today}: ${domSeances.length} films`);
      domSeances.forEach(({ title, director, duration, genre, heures }) => {
        if (!result.films[title]) result.films[title] = { title, director, duration, genre };
        if (!result.seances[title]) result.seances[title] = {};
        result.seances[title][today] = heures;
      });
    }
  } catch (e) {
    console.log(`    ✗ Page J: ${e.message}`);
  }

  // Charger chaque date pour déclencher les requêtes API
  const futureDates = availableDates
    .filter(d => d > getDateISO(0))
    .slice(0, DAYS - 1);

  for (const dateISO of futureDates) {
    try {
      const url = `https://www.allocine.fr/seance/salle_gen_csalle=${cinema.allocineId}.html?date=${dateISO}`;
      await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 });
      await sleep(1500);

      // Récupérer depuis données capturées par l'intercepteur réseau
      const apiSeances = capturedData[dateISO] || [];
      // + extraction DOM de secours
      const domSeances = await page.evaluate(() => {
        const results = [];
        document.querySelectorAll('.movie-card-theater').forEach(card => {
          const titleEl = card.querySelector('a[href*="fichefilm"], .meta-title-link, h2 a');
          const title = titleEl?.textContent?.trim();
          if (!title || title.length > 120) return;
          const heures = [];
          card.querySelectorAll('.showtimes-hour-item-value, .showtimes-hour-item').forEach(el => {
            const m = el.textContent?.trim().match(/(\d{1,2})h(\d{2})/i);
            if (m) { const h = parseInt(m[1]); if (h >= 6 && h <= 23) heures.push(`${h}h${m[2]}`); }
          });
          if (heures.length) results.push({ title, heures: [...new Set(heures)].sort() });
        });
        return results;
      });

      const allSeances = [...apiSeances, ...domSeances];
      for (const { title, director='', duration='', genre='', heures } of allSeances) {
        if (!result.films[title]) result.films[title] = { title, director, duration, genre };
        if (!result.seances[title]) result.seances[title] = {};
        result.seances[title][dateISO] = [...new Set([...(result.seances[title][dateISO]||[]), ...heures])];
      }
      console.log(`    ✓ ${dateISO}: ${allSeances.length} films`);
    } catch (e) {
      console.log(`    ✗ ${dateISO}: ${e.message}`);
    }
    await sleep(800);
  }

  // Intégrer les données capturées par l'intercepteur pour toutes les dates
  for (const [dateISO, seances] of Object.entries(capturedData)) {
    for (const { title, director, duration, genre, heures } of seances) {
      if (!result.films[title]) result.films[title] = { title, director, duration, genre };
      if (!result.seances[title]) result.seances[title] = {};
      result.seances[title][dateISO] = [...new Set([...(result.seances[title][dateISO]||[]), ...heures])];
    }
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
