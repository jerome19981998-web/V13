#!/usr/bin/env node
// CinéMatch Scraper v9 — Fix releaseYear + structure UGC GraphQL
'use strict';

const https = require('https');
const http  = require('http');

// ─── CONFIG ────────────────────────────────────────────────────────────────
const DRY_RUN  = process.env.DRY_RUN === 'true';
const DAYS     = 7;
const SUPA_URL = 'https://alwfbminhdwinxcozjlj.supabase.co';
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const TMDB_TOKEN = process.env.TMDB_TOKEN ||
  'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIzMzY0M2EwMDRiZGMyYzdlNmIyYTFjOWMzZWI5ZDhlYyIsIm5iZiI6MTc3MzAwMTIzNy42ODYsInN1YiI6IjY5YWRkYTE1MmVmNWMxZmY5NWZjYmNlOCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.bRW2UVqu1p89xPusKV5-mzW4ZeRSk8ij811FWOIwoBM';

// ─── CINEMAS ────────────────────────────────────────────────────────────────
const CINEMAS = {
  'ugc-halles':        { name:'UGC Ciné Cité Les Halles',   chain:'ugc',    ugcId:'C0159', allocineId:'C0159', lat:48.8603, lng:2.3477, addr:'7 place de la Rotonde, 75001', metro:'Les Halles' },
  'ugc-bercy':         { name:'UGC Ciné Cité Bercy',        chain:'ugc',    ugcId:'C0157', allocineId:'C0157', lat:48.8392, lng:2.3796, addr:'2 cour Saint-Émilion, 75012',  metro:'Cour Saint-Émilion' },
  'ugc-paris19':       { name:'UGC Ciné Cité Paris 19',     chain:'ugc',    ugcId:'C0173', allocineId:'C0173', lat:48.8848, lng:2.3834, addr:'1 rue du Cinéma, 75019',        metro:'Corentin Cariou' },
  'ugc-maillot':       { name:'UGC Maillot',                chain:'ugc',    ugcId:'C0162', allocineId:'C0162', lat:48.8790, lng:2.2835, addr:'74 av de la Grande Armée, 75017', metro:'Argentine' },
  'ugc-opera':         { name:'UGC Opéra',                  chain:'ugc',    ugcId:'C0164', allocineId:'C0164', lat:48.8703, lng:2.3340, addr:'32 bd des Italiens, 75009',     metro:'Opéra' },
  'ugc-danton':        { name:'UGC Danton',                 chain:'ugc',    ugcId:'C0158', allocineId:'C0158', lat:48.8527, lng:2.3403, addr:'99 bd du Montparnasse, 75006',  metro:'Vavin' },
  'ugc-montparnasse':  { name:'UGC Montparnasse',           chain:'ugc',    ugcId:'C0163', allocineId:'C0163', lat:48.8418, lng:2.3230, addr:'13 rue du Commandant Mouchotte', metro:'Montparnasse' },
  'ugc-lyon':          { name:'UGC Lyon-Bastille',          chain:'ugc',    ugcId:'C0161', allocineId:'C0161', lat:48.8531, lng:2.3696, addr:'18 rue du Faubourg St-Antoine',  metro:'Bastille' },
  'pathe-beaugrenelle':{ name:'Pathé Beaugrenelle',         chain:'pathe',  ugcId:null,    allocineId:'C0159', lat:48.8463, lng:2.2885, addr:'12 rue Linois, 75015',           metro:'Charles Michels' },
  'pathe-convention':  { name:'Pathé Convention',           chain:'pathe',  ugcId:null,    allocineId:'C0037', lat:48.8382, lng:2.3072, addr:'27 rue Alain-Chartier, 75015',   metro:'Convention' },
  'pathe-parnasse':    { name:'Pathé Parnasse',             chain:'pathe',  ugcId:null,    allocineId:'C0122', lat:48.8427, lng:2.3271, addr:'11 rue du Départ, 75014',        metro:'Montparnasse' },
  'pathe-wepler':      { name:'Pathé Wepler',               chain:'pathe',  ugcId:null,    allocineId:'C0060', lat:48.8841, lng:2.3272, addr:'14 place de Clichy, 75018',      metro:'Place de Clichy' },
  'pathe-alesia':      { name:'Pathé Alésia',               chain:'pathe',  ugcId:null,    allocineId:'C0116', lat:48.8277, lng:2.3260, addr:'73 av du Général Leclerc, 75014', metro:'Alésia' },
  'pathe-batignolles': { name:'Les 7 Batignolles',          chain:'pathe',  ugcId:null,    allocineId:'C0059', lat:48.8856, lng:2.3175, addr:'3 rue des Moines, 75017',        metro:'Brochant' },
  'gaumont-opera':     { name:'Gaumont Opéra',              chain:'gaumont',ugcId:null,    allocineId:'C0026', lat:48.8716, lng:2.3329, addr:'31 bd des Italiens, 75002',      metro:'Opéra' },
  'gaumont-convention':{ name:'Gaumont Convention',         chain:'gaumont',ugcId:null,    allocineId:'C0038', lat:48.8384, lng:2.3060, addr:'25 rue Alain-Chartier, 75015',   metro:'Convention' },
  'gaumont-aquaboulevard':{ name:'Gaumont Aquaboulevard',   chain:'gaumont',ugcId:null,    allocineId:'C0015', lat:48.8322, lng:2.2760, addr:'17 rue Linois, 75015',           metro:'Balard' },
};

// ─── UTILS ──────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

function getDateISO(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function toHeure(s) {
  if (!s) return null;
  const m = String(s).match(/(\d{1,2})[h:H](\d{2})/);
  if (m) return `${m[1]}h${m[2]}`;
  const m2 = String(s).match(/^(\d{3,4})$/);
  if (m2) { const v = m2[1].padStart(4,'0'); return `${parseInt(v.slice(0,2))}h${v.slice(2)}`; }
  return null;
}

function fetchJSON(url, opts = {}) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'application/json',
        ...opts.headers,
      },
      timeout: 12000,
    };
    const req = mod.get(url, options, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchJSON(res.headers.location, opts).then(resolve);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function fetchText(url, opts = {}) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        ...opts.headers,
      },
      timeout: 12000,
    };
    const req = mod.get(url, options, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchText(res.headers.location, opts).then(resolve);
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', () => resolve(''));
    req.on('timeout', () => { req.destroy(); resolve(''); });
  });
}

// ─── UGC GRAPHQL ─────────────────────────────────────────────────────────────
async function fetchUGC(cinemaCode, dateISO) {
  const query = `{showtimes(cinemaCode:"${cinemaCode}",date:"${dateISO}"){movie{internalId title originalTitle runtime genres{tag} synopsis releases{releaseDate} poster{url} credits{person{fullName} role} stats{userRating{score}}}showtimes{internalId diffusionVersion startsAt lang}}}`;
  const url = `https://graph.allocine.fr/v1/public?query=${encodeURIComponent(query)}`;
  const data = await fetchJSON(url, {
    headers: {
      'Authorization': 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcHAiOiJhbGxvY2luZSIsInR5cGUiOiJhbm9ueW1vdXMiLCJpYXQiOjE3MzAwMDAwMDB9.dummy',
      'AC-Auth-Token': 'v3/6.0',
    }
  });
  return data?.data?.showtimes || null;
}

// ─── ALLOCINE HTML FALLBACK ───────────────────────────────────────────────────
async function fetchAllocineHTML(allocineId, dateISO) {
  const today = getDateISO(0);
  const url = dateISO === today
    ? `https://www.allocine.fr/seance/salle_gen_csalle=${allocineId}.html`
    : `https://www.allocine.fr/seance/salle_gen_csalle=${allocineId}/date-${dateISO}/`;

  const html = await fetchText(url);
  if (!html || html.length < 500) return [];

  const results = [];
  // Extract __NEXT_DATA__ JSON
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (m) {
    try {
      const nextData = JSON.parse(m[1]);
      // Navigate to showtimes data
      const page = nextData?.props?.pageProps;
      const showtimes = page?.showtimes || page?.showTimesPage?.showtimes || [];
      for (const st of showtimes) {
        const movie = st.movie || st.film || {};
        const title = movie.title || movie.titre || '';
        if (!title) continue;

        // ── KEY FIX: safely extract releaseYear ──
        let releaseYear = null;
        const releaseDateRaw =
          movie.releases?.[0]?.releaseDate ||
          movie.release?.releaseDate ||
          movie.releaseDate ||
          '';
        if (releaseDateRaw) {
          releaseYear = String(releaseDateRaw).slice(0, 4);
        }

        const runtime = movie.runtime || movie.duree || 0;
        const duration = runtime ? `${Math.floor(runtime/60)}h${String(runtime%60).padStart(2,'0')}` : '';
        const genre = (movie.genres?.[0]?.tag || movie.genre || '').toLowerCase();
        const synopsis = movie.synopsis || movie.synopsisShort || '';
        const director = movie.credits?.find(c => c.role === 'Director' || c.role === 'DIRECTOR')?.person?.fullName
                      || movie.directors?.[0]?.fullName || '';
        const poster = movie.poster?.url || movie.affiche?.url || null;
        const tmdbNote = movie.stats?.userRating?.score || null;

        const heures = (st.showtimes || [])
          .map(s => toHeure(s.startsAt || s.time))
          .filter(Boolean);

        if (title && heures.length) {
          results.push({ title, director, duration, genre, synopsis, poster, tmdbNote, releaseYear, heures });
        }
      }
      if (results.length) return results;
    } catch(e) {}
  }

  // Fallback: parse HTML with regex
  const filmBlocks = html.split(/class="[^"]*entity-card[^"]*"/);
  for (const block of filmBlocks.slice(1)) {
    const titleM = block.match(/class="[^"]*meta-title[^"]*"[^>]*>([^<]+)</);
    if (!titleM) continue;
    const title = titleM[1].trim();
    const timeMatches = [...block.matchAll(/(\d{1,2}[h:]\d{2})/g)];
    const heures = [...new Set(timeMatches.map(m => toHeure(m[1])).filter(Boolean))];
    if (heures.length) results.push({ title, director:'', duration:'', genre:'', synopsis:'', poster:null, tmdbNote:null, releaseYear:null, heures });
  }
  return results;
}

// ─── SCRAPE CINEMA ─────────────────────────────────────────────────────────
async function scrapeCinema(cinemaId, cinema) {
  console.log(`\n📍 ${cinemaId}...`);
  const result = { films: {}, seances: {} };

  for (let day = 0; day < DAYS; day++) {
    const dateISO = getDateISO(day);
    let seancesJour = [];

    // Try UGC GraphQL first for all cinemas (AlloCiné graph API)
    const ugcCode = cinema.ugcId || cinema.allocineId;
    if (ugcCode) {
      const graphData = await fetchUGC(ugcCode, dateISO);
      if (graphData && graphData.length > 0) {
        for (const item of graphData) {
          const movie = item.movie || {};
          const title = movie.title || movie.originalTitle || '';
          if (!title) continue;

          // ── Safe releaseYear extraction ──
          let releaseYear = null;
          try {
            const rd = movie.releases?.[0]?.releaseDate || '';
            if (rd) releaseYear = String(rd).slice(0, 4);
          } catch(e) {}

          const runtime = movie.runtime || 0;
          const duration = runtime ? `${Math.floor(runtime/60)}h${String(runtime%60).padStart(2,'0')}` : '';
          const genre = (movie.genres?.[0]?.tag || '').toLowerCase();
          const synopsis = movie.synopsis || '';
          const director = (movie.credits || []).find(c => c.role === 'Director' || c.role === 'DIRECTOR')?.person?.fullName || '';
          const poster = movie.poster?.url || null;
          const tmdbNote = movie.stats?.userRating?.score || null;

          const heures = (item.showtimes || [])
            .map(s => toHeure(s.startsAt || ''))
            .filter(Boolean);

          if (heures.length) {
            seancesJour.push({ title, director, duration, genre, synopsis, poster, tmdbNote, releaseYear, heures });
          }
        }
        if (seancesJour.length) {
          console.log(`  ${dateISO}: ${seancesJour.length} films (GraphQL)`);
        }
      }
    }

    // Fallback: HTML scraping
    if (!seancesJour.length) {
      seancesJour = await fetchAllocineHTML(cinema.allocineId, dateISO);
      if (seancesJour.length) {
        console.log(`  ${dateISO}: ${seancesJour.length} films (HTML fallback)`);
      } else {
        console.log(`  ${dateISO}: aucune séance`);
      }
    }

    // Store results
    for (const { title, director, duration, genre, synopsis, poster, tmdbNote, heures } of seancesJour) {
      if (!title || !heures.length) continue;
      const slug = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
                       .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      if (!result.films[slug]) {
        result.films[slug] = { slug, title, director: director||'', duration: duration||'', genre: genre||'', synopsis: synopsis||'', poster: poster||null, tmdbNote: tmdbNote||null };
      }
      if (!result.seances[slug]) result.seances[slug] = {};
      const existing = result.seances[slug][dateISO] || [];
      result.seances[slug][dateISO] = [...new Set([...existing, ...heures])].sort();
    }

    await sleep(350);
  }

  return result;
}

// ─── ENRICHISSEMENT TMDB ─────────────────────────────────────────────────────
async function enrichWithTMDB(films) {
  console.log('\n🎬 Enrichissement TMDB...');
  const entries = Object.entries(films);
  for (let i = 0; i < entries.length; i++) {
    const [slug, film] = entries[i];
    if (film.poster && film.tmdbNote) continue; // already enriched
    try {
      const res = await fetchJSON(
        `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(film.title)}&language=fr-FR&region=FR`,
        { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } }
      );
      const movie = res?.results?.[0];
      if (!movie) continue;

      if (!film.poster && movie.poster_path) film.poster = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;
      if (!film.tmdbNote && movie.vote_average > 0) film.tmdbNote = Math.round(movie.vote_average * 10) / 10;
      if (!film.synopsis && movie.overview) film.synopsis = movie.overview;
      film.tmdbId = movie.id;

      // Trailer
      const vRes = await fetchJSON(
        `https://api.themoviedb.org/3/movie/${movie.id}/videos?language=fr-FR`,
        { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } }
      );
      const trailer = vRes?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube')
                   || vRes?.results?.find(v => v.site === 'YouTube');
      if (trailer) film.trailerKey = trailer.key;

      console.log(`  ✓ ${film.title}`);
      await sleep(200);
    } catch(e) {
      console.warn(`  ⚠ TMDB: ${film.title} — ${e.message}`);
    }
  }
}

// ─── PUSH SUPABASE ────────────────────────────────────────────────────────────
async function supaRequest(path, method, body) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname: 'alwfbminhdwinxcozjlj.supabase.co',
      path: `/rest/v1/${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${SUPA_KEY}`,
        'Prefer': 'resolution=merge-duplicates',
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', e => resolve({ status: 0, body: e.message }));
    req.write(payload);
    req.end();
  });
}

async function pushToSupabase(allData) {
  console.log('\n📤 Push vers Supabase...');

  // Cinémas
  const cinemasRows = Object.entries(CINEMAS).map(([id, c]) => ({
    id, name: c.name, chain: c.chain, lat: c.lat, lng: c.lng, addr: c.addr, metro: c.metro,
  }));
  const cRes = await supaRequest('cinemas_dyn', 'POST', cinemasRows);
  console.log(`  cinémas: ${cRes.status}`);

  // Films uniques
  const allFilms = {};
  for (const { films } of Object.values(allData)) {
    for (const [slug, f] of Object.entries(films)) {
      if (!allFilms[slug]) allFilms[slug] = { ...f };
    }
  }
  await enrichWithTMDB(allFilms);

  const filmsRows = Object.entries(allFilms).map(([slug, f]) => ({
    id: slug, title: f.title, director: f.director||'', duration: f.duration||'',
    genre: f.genre||'', synopsis: f.synopsis||'', poster_url: f.poster||null,
    tmdb_id: f.tmdbId||null, tmdb_note: f.tmdbNote||null, trailer_key: f.trailerKey||null,
    updated_at: new Date().toISOString(),
  }));
  const fRes = await supaRequest('films_dyn', 'POST', filmsRows);
  console.log(`  films: ${fRes.status} (${filmsRows.length} films)`);

  // Séances
  const seancesRows = [];
  for (const [cinemaId, data] of Object.entries(allData)) {
    for (const [slug, dates] of Object.entries(data.seances)) {
      for (const [date, heures] of Object.entries(dates)) {
        if (heures.length) seancesRows.push({ cinema_id: cinemaId, film_id: slug, date, heures });
      }
    }
  }
  // Delete old seances first
  const delRes = await supaRequest(`seances_dyn?date=gte.${getDateISO(0)}`, 'DELETE', {});
  console.log(`  delete ancien: ${delRes.status}`);

  // Insert in batches of 200
  for (let i = 0; i < seancesRows.length; i += 200) {
    const batch = seancesRows.slice(i, i + 200);
    const sRes = await supaRequest('seances_dyn', 'POST', batch);
    if (sRes.status > 299) console.error(`  ❌ séances batch ${i}: ${sRes.status} ${sRes.body.slice(0,200)}`);
  }
  console.log(`  séances: ${seancesRows.length} lignes insérées`);
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  const date = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
  console.log(`🎬 CinéMatch Scraper v9 — ${date}`);
  console.log(DRY_RUN ? '🔍 DRY-RUN' : '🚀 PRODUCTION');
  console.log('─'.repeat(50));

  const allData = {};
  for (const [id, cinema] of Object.entries(CINEMAS)) {
    try { allData[id] = await scrapeCinema(id, cinema); }
    catch(e) { console.error(`❌ ${id}:`, e.message); allData[id] = { films:{}, seances:{} }; }
    await sleep(300);
  }

  let totalFilms = new Set(), totalSeances = 0;
  for (const [cid, data] of Object.entries(allData)) {
    const nf = Object.keys(data.films).length;
    const ns = Object.values(data.seances).reduce((s,fd) => s + Object.values(fd).reduce((a,h)=>a+h.length,0), 0);
    Object.keys(data.films).forEach(t => totalFilms.add(t));
    totalSeances += ns;
    if (nf > 0) console.log(`  ✓ ${cid}: ${nf} films, ${ns} séances`);
    else         console.log(`  ✗ ${cid}: aucun résultat`);
  }
  console.log(`\n📊 TOTAL: ${totalFilms.size} films, ${totalSeances} séances`);

  if (DRY_RUN) {
    const ex = Object.entries(allData).find(([,d]) => Object.keys(d.seances).length > 0);
    if (ex) {
      console.log(`\n🔍 Exemple (${ex[0]}):`);
      Object.entries(ex[1].seances).slice(0,3).forEach(([slug, dates]) => {
        const title = allData[ex[0]].films[slug]?.title || slug;
        console.log(`  "${title}":`);
        Object.entries(dates).forEach(([d,h]) => console.log(`    ${d}: ${h.join(', ')}`));
      });
    }
    return;
  }

  if (!SUPA_KEY) { console.error('❌ SUPABASE_SERVICE_KEY manquante'); process.exit(1); }
  await pushToSupabase(allData);
}

main().catch(e => { console.error('❌ Fatal:', e); process.exit(1); });
