#!/usr/bin/env node
// CinéMatch Scraper v10 — HTML scraping AlloCiné (robuste, sans API GraphQL)
'use strict';

const https = require('https');

// ─── CONFIG ────────────────────────────────────────────────────────────────
const DRY_RUN  = process.env.DRY_RUN === 'true';
const DAYS     = 7;
const SUPA_URL = 'https://alwfbminhdwinxcozjlj.supabase.co';
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const TMDB_TOKEN = process.env.TMDB_TOKEN ||
  'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIzMzY0M2EwMDRiZGMyYzdlNmIyYTFjOWMzZWI5ZDhlYyIsIm5iZiI6MTc3MzAwMTIzNy42ODYsInN1YiI6IjY5YWRkYTE1MmVmNWMxZmY5NWZjYmNlOCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.bRW2UVqu1p89xPusKV5-mzW4ZeRSk8ij811FWOIwoBM';

// ─── CINEMAS ────────────────────────────────────────────────────────────────
const CINEMAS = {
  'ugc-halles':           { name:'UGC Ciné Cité Les Halles',   chain:'ugc',    allocineId:'C0159', lat:48.8603, lng:2.3477, addr:'7 place de la Rotonde, 75001',      metro:'Les Halles' },
  'ugc-bercy':            { name:'UGC Ciné Cité Bercy',        chain:'ugc',    allocineId:'C0157', lat:48.8392, lng:2.3796, addr:'2 cour Saint-Émilion, 75012',        metro:'Cour Saint-Émilion' },
  'ugc-paris19':          { name:'UGC Ciné Cité Paris 19',     chain:'ugc',    allocineId:'C0173', lat:48.8848, lng:2.3834, addr:'1 rue du Cinéma, 75019',             metro:'Corentin Cariou' },
  'ugc-maillot':          { name:'UGC Maillot',                chain:'ugc',    allocineId:'C0162', lat:48.8790, lng:2.2835, addr:'74 av de la Grande Armée, 75017',    metro:'Argentine' },
  'ugc-opera':            { name:'UGC Opéra',                  chain:'ugc',    allocineId:'C0164', lat:48.8703, lng:2.3340, addr:'32 bd des Italiens, 75009',          metro:'Opéra' },
  'ugc-danton':           { name:'UGC Danton',                 chain:'ugc',    allocineId:'C0158', lat:48.8527, lng:2.3403, addr:'99 bd du Montparnasse, 75006',       metro:'Vavin' },
  'ugc-montparnasse':     { name:'UGC Montparnasse',           chain:'ugc',    allocineId:'C0163', lat:48.8418, lng:2.3230, addr:'13 rue du Commandant Mouchotte',     metro:'Montparnasse' },
  'ugc-lyon':             { name:'UGC Lyon-Bastille',          chain:'ugc',    allocineId:'C0161', lat:48.8531, lng:2.3696, addr:'18 rue du Faubourg St-Antoine',      metro:'Bastille' },
  'pathe-beaugrenelle':   { name:'Pathé Beaugrenelle',         chain:'pathe',  allocineId:'C0012', lat:48.8463, lng:2.2885, addr:'12 rue Linois, 75015',               metro:'Charles Michels' },
  'pathe-convention':     { name:'Pathé Convention',           chain:'pathe',  allocineId:'C0037', lat:48.8382, lng:2.3072, addr:'27 rue Alain-Chartier, 75015',       metro:'Convention' },
  'pathe-parnasse':       { name:'Pathé Parnasse',             chain:'pathe',  allocineId:'C0122', lat:48.8427, lng:2.3271, addr:'11 rue du Départ, 75014',            metro:'Montparnasse' },
  'pathe-wepler':         { name:'Pathé Wepler',               chain:'pathe',  allocineId:'C0060', lat:48.8841, lng:2.3272, addr:'14 place de Clichy, 75018',          metro:'Place de Clichy' },
  'pathe-alesia':         { name:'Pathé Alésia',               chain:'pathe',  allocineId:'C0116', lat:48.8277, lng:2.3260, addr:'73 av du Général Leclerc, 75014',    metro:'Alésia' },
  'pathe-batignolles':    { name:'Les 7 Batignolles',          chain:'pathe',  allocineId:'C0059', lat:48.8856, lng:2.3175, addr:'3 rue des Moines, 75017',            metro:'Brochant' },
  'gaumont-opera':        { name:'Gaumont Opéra',              chain:'gaumont',allocineId:'C0026', lat:48.8716, lng:2.3329, addr:'31 bd des Italiens, 75002',          metro:'Opéra' },
  'gaumont-convention':   { name:'Gaumont Convention',         chain:'gaumont',allocineId:'C0038', lat:48.8384, lng:2.3060, addr:'25 rue Alain-Chartier, 75015',       metro:'Convention' },
  'gaumont-aquaboulevard':{ name:'Gaumont Aquaboulevard',      chain:'gaumont',allocineId:'C0015', lat:48.8322, lng:2.2760, addr:'17 rue Linois, 75015',               metro:'Balard' },
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
  s = String(s).trim();
  const m1 = s.match(/(\d{1,2})[h:H](\d{2})/);
  if (m1) return `${parseInt(m1[1])}h${m1[2]}`;
  const m2 = s.match(/^(\d{3,4})$/);
  if (m2) { const v = m2[1].padStart(4,'0'); return `${parseInt(v.slice(0,2))}h${v.slice(2)}`; }
  return null;
}

function slugify(title) {
  return title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
              .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}

function fetchText(url) {
  return new Promise((resolve) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Accept-Encoding': 'identity',
        'Connection': 'keep-alive',
      },
      timeout: 15000,
    };
    const req = https.get(url, options, res => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        return fetchText(res.headers.location).then(resolve);
      }
      if (res.statusCode !== 200) { resolve({ html:'', status: res.statusCode }); return; }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', c => { data += c; });
      res.on('end', () => resolve({ html: data, status: 200 }));
    });
    req.on('error', e => resolve({ html:'', status:0, err: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ html:'', status:0, err:'timeout' }); });
  });
}

function fetchJSON(url, extraHeaders = {}) {
  return new Promise((resolve) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
        ...extraHeaders,
      },
      timeout: 12000,
    };
    const req = https.get(url, options, res => {
      if ([301,302].includes(res.statusCode) && res.headers.location) {
        return fetchJSON(res.headers.location, extraHeaders).then(resolve);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// ─── PARSE HTML ALLOCINE ─────────────────────────────────────────────────────
function parseAllocineHTML(html) {
  const results = [];
  if (!html || html.length < 1000) return results;

  // 1. Try __NEXT_DATA__ (modern Next.js page)
  const nextM = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextM) {
    try {
      const nd = JSON.parse(nextM[1]);
      // Try multiple paths where showtimes can be nested
      const paths = [
        nd?.props?.pageProps?.showtimes,
        nd?.props?.pageProps?.showTimesPage?.showtimes,
        nd?.props?.pageProps?.data?.showtimes,
        nd?.props?.pageProps?.theaterShowtimes,
      ];
      for (const showtimes of paths) {
        if (!Array.isArray(showtimes) || showtimes.length === 0) continue;
        for (const st of showtimes) {
          const movie = st.movie || st.film || {};
          const title = movie.title || movie.titre || '';
          if (!title) continue;
          const runtime = movie.runtime || movie.duree || 0;
          const duration = runtime ? `${Math.floor(runtime/60)}h${String(runtime%60).padStart(2,'0')}` : '';
          const genre = (movie.genres?.[0]?.tag || movie.genres?.[0] || '').toLowerCase();
          const synopsis = movie.synopsis || movie.synopsisShort || '';
          const director = (movie.credits || []).find(c =>
            c.role === 'Director' || c.role === 'DIRECTOR' || c.function === 'Réalisateur'
          )?.person?.fullName || '';
          const poster = movie.poster?.url || movie.affiche?.url || null;
          const tmdbNote = movie.stats?.userRating?.score || null;
          const allShowtimes = st.showtimes || st.seances || [];
          const heures = allShowtimes
            .map(s => toHeure(s.startsAt || s.time || s.heure || ''))
            .filter(Boolean);
          if (title && heures.length) {
            results.push({ title, director, duration, genre, synopsis, poster, tmdbNote, heures });
          }
        }
        if (results.length > 0) return results;
      }
    } catch(e) {
      // fall through to regex
    }
  }

  // 2. Fallback: regex sur le HTML brut
  // Trouver les blocs de films
  const filmSections = html.split(/<div[^>]+class="[^"]*entity-card-list[^"]*"/);
  for (const section of filmSections.slice(1)) {
    const titleM = section.match(/class="[^"]*meta-title[^"]*"[^>]*>\s*<[^>]+>\s*([^<]+)</);
    if (!titleM) continue;
    const title = titleM[1].trim();
    if (!title || title.length < 2) continue;
    // Extraire les horaires
    const timePattern = /(\d{1,2}[h:]\d{2})/g;
    const heures = [...new Set([...section.matchAll(timePattern)].map(m => toHeure(m[1])).filter(Boolean))];
    if (heures.length > 0) {
      results.push({ title, director:'', duration:'', genre:'', synopsis:'', poster:null, tmdbNote:null, heures });
    }
  }

  // 3. Dernier recours: extraction globale des horaires par film
  if (results.length === 0) {
    const movieBlocks = [...html.matchAll(/<section[^>]*class="[^"]*movie-card[^"]*"[\s\S]*?<\/section>/g)];
    for (const [block] of movieBlocks) {
      const tM = block.match(/<h2[^>]*>([^<]+)<\/h2>/);
      if (!tM) continue;
      const title = tM[1].trim();
      const heures = [...new Set([...block.matchAll(/(\d{1,2}h\d{2})/g)].map(m => m[1]))].sort();
      if (heures.length) results.push({ title, director:'', duration:'', genre:'', synopsis:'', poster:null, tmdbNote:null, heures });
    }
  }

  return results;
}

// ─── SCRAPE 1 CINEMA ────────────────────────────────────────────────────────
async function scrapeCinema(cinemaId, cinema) {
  console.log(`\n📍 ${cinemaId} (${cinema.allocineId})`);
  const result = { films: {}, seances: {} };

  for (let day = 0; day < DAYS; day++) {
    const dateISO = getDateISO(day);
    const today = getDateISO(0);

    const url = dateISO === today
      ? `https://www.allocine.fr/seance/salle_gen_csalle=${cinema.allocineId}.html`
      : `https://www.allocine.fr/seance/salle_gen_csalle=${cinema.allocineId}/date-${dateISO}/`;

    const { html, status, err } = await fetchText(url);

    if (status !== 200) {
      console.log(`  ${dateISO}: ⚠ HTTP ${status}${err?' ('+err+')':''}`);
      await sleep(500);
      continue;
    }

    const seances = parseAllocineHTML(html);
    console.log(`  ${dateISO}: ${seances.length} films (HTML ${html.length} chars)`);

    // Debug first day
    if (day === 0 && seances.length === 0) {
      const hasNextData = html.includes('__NEXT_DATA__');
      const hasMovieCard = html.includes('entity-card') || html.includes('movie-card');
      console.log(`    [debug] __NEXT_DATA__:${hasNextData} movieCard:${hasMovieCard} htmlLen:${html.length}`);
    }

    for (const { title, director, duration, genre, synopsis, poster, tmdbNote, heures } of seances) {
      const slug = slugify(title);
      if (!result.films[slug]) {
        result.films[slug] = { slug, title, director, duration, genre, synopsis, poster, tmdbNote };
      }
      if (!result.seances[slug]) result.seances[slug] = {};
      const prev = result.seances[slug][dateISO] || [];
      result.seances[slug][dateISO] = [...new Set([...prev, ...heures])].sort();
    }

    await sleep(600); // respectful crawling
  }

  const nFilms = Object.keys(result.films).length;
  const nSeances = Object.values(result.seances).reduce((s,fd)=>s+Object.values(fd).reduce((a,h)=>a+h.length,0),0);
  console.log(`  → ${nFilms} films, ${nSeances} séances`);
  return result;
}

// ─── TMDB ENRICHISSEMENT ────────────────────────────────────────────────────
async function enrichWithTMDB(films) {
  console.log('\n🎬 Enrichissement TMDB...');
  let enriched = 0;
  for (const [slug, film] of Object.entries(films)) {
    try {
      const data = await fetchJSON(
        `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(film.title)}&language=fr-FR&region=FR`,
        { Authorization: `Bearer ${TMDB_TOKEN}` }
      );
      const movie = data?.results?.[0];
      if (!movie) continue;
      if (!film.poster && movie.poster_path)      film.poster    = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;
      if (!film.tmdbNote && movie.vote_average>0) film.tmdbNote  = Math.round(movie.vote_average*10)/10;
      if (!film.synopsis && movie.overview)       film.synopsis  = movie.overview;
      film.tmdbId = movie.id;
      // Trailer
      const vd = await fetchJSON(
        `https://api.themoviedb.org/3/movie/${movie.id}/videos?language=fr-FR`,
        { Authorization: `Bearer ${TMDB_TOKEN}` }
      );
      const t = vd?.results?.find(v=>v.type==='Trailer'&&v.site==='YouTube') || vd?.results?.find(v=>v.site==='YouTube');
      if (t) film.trailerKey = t.key;
      enriched++;
      await sleep(220);
    } catch(e) {
      console.warn(`  ⚠ TMDB ${film.title}: ${e.message}`);
    }
  }
  console.log(`  ✓ ${enriched}/${Object.keys(films).length} enrichis`);
}

// ─── PUSH SUPABASE ────────────────────────────────────────────────────────────
function supaReq(path, method, body) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(body);
    const isDelete = method === 'DELETE';
    const options = {
      hostname: 'alwfbminhdwinxcozjlj.supabase.co',
      path: `/rest/v1/${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${SUPA_KEY}`,
        'Prefer': 'resolution=merge-duplicates',
        ...(isDelete ? {} : { 'Content-Length': Buffer.byteLength(payload) }),
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', e => resolve({ status:0, body: e.message }));
    if (!isDelete) req.write(payload);
    req.end();
  });
}

async function pushToSupabase(allData) {
  console.log('\n📤 Push Supabase...');

  // 1. Cinémas
  const cinRows = Object.entries(CINEMAS).map(([id,c])=>({
    id, name:c.name, chain:c.chain, lat:c.lat, lng:c.lng, addr:c.addr, metro:c.metro,
  }));
  const cr = await supaReq('cinemas_dyn', 'POST', cinRows);
  console.log(`  cinémas: ${cr.status}`);

  // 2. Agréger tous les films
  const allFilms = {};
  for (const {films} of Object.values(allData)) {
    for (const [slug, f] of Object.entries(films)) {
      if (!allFilms[slug]) allFilms[slug] = { ...f };
      else {
        // Merge: prefer non-empty values
        for (const k of ['director','duration','genre','synopsis','poster','tmdbNote']) {
          if (!allFilms[slug][k] && f[k]) allFilms[slug][k] = f[k];
        }
      }
    }
  }
  await enrichWithTMDB(allFilms);

  const filmRows = Object.values(allFilms).map(f=>({
    id: f.slug, title: f.title, director: f.director||'', duration: f.duration||'',
    genre: f.genre||'', synopsis: f.synopsis||'', poster_url: f.poster||null,
    tmdb_id: f.tmdbId||null, tmdb_note: f.tmdbNote||null, trailer_key: f.trailerKey||null,
    updated_at: new Date().toISOString(),
  }));
  const fr = await supaReq('films_dyn', 'POST', filmRows);
  console.log(`  films: ${fr.status} (${filmRows.length})`);

  // 3. Séances — supprimer les futures puis réinsérer
  const today = getDateISO(0);
  const dr = await supaReq(`seances_dyn?date=gte.${today}`, 'DELETE', {});
  console.log(`  delete séances futures: ${dr.status}`);

  const seanceRows = [];
  for (const [cinId, {seances}] of Object.entries(allData)) {
    for (const [slug, dates] of Object.entries(seances)) {
      for (const [date, heures] of Object.entries(dates)) {
        if (heures.length) seanceRows.push({ cinema_id: cinId, film_id: slug, date, heures });
      }
    }
  }

  let inserted = 0;
  for (let i = 0; i < seanceRows.length; i += 200) {
    const batch = seanceRows.slice(i, i+200);
    const sr = await supaReq('seances_dyn', 'POST', batch);
    if (sr.status > 299) console.error(`  ❌ batch ${i}: ${sr.status} — ${sr.body.slice(0,150)}`);
    else inserted += batch.length;
  }
  console.log(`  séances insérées: ${inserted}/${seanceRows.length}`);
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  const date = new Date().toLocaleString('fr-FR',{timeZone:'Europe/Paris'});
  console.log(`🎬 CinéMatch Scraper v10 — ${date}`);
  console.log(DRY_RUN ? '🔍 DRY-RUN' : '🚀 PRODUCTION');
  console.log('─'.repeat(50));

  const allData = {};
  for (const [id, cinema] of Object.entries(CINEMAS)) {
    try { allData[id] = await scrapeCinema(id, cinema); }
    catch(e) { console.error(`❌ ${id}: ${e.message}`); allData[id] = { films:{}, seances:{} }; }
    await sleep(400);
  }

  // Résumé
  console.log('\n' + '─'.repeat(50));
  let totalFilms = new Set(), totalSeances = 0;
  for (const [cid, data] of Object.entries(allData)) {
    const nf = Object.keys(data.films).length;
    const ns = Object.values(data.seances).reduce((s,fd)=>s+Object.values(fd).reduce((a,h)=>a+h.length,0),0);
    Object.keys(data.films).forEach(t => totalFilms.add(t));
    totalSeances += ns;
    console.log(`  ${nf>0?'✓':'✗'} ${cid}: ${nf} films, ${ns} séances`);
  }
  console.log(`\n📊 TOTAL: ${totalFilms.size} films uniques, ${totalSeances} séances`);

  if (DRY_RUN) {
    const ex = Object.entries(allData).find(([,d])=>Object.keys(d.seances).length>0);
    if (ex) {
      const [cid, data] = ex;
      console.log(`\n🔍 Exemple (${cid}):`);
      Object.entries(data.seances).slice(0,3).forEach(([slug,dates])=>{
        const title = data.films[slug]?.title || slug;
        console.log(`  "${title}":`);
        Object.entries(dates).forEach(([d,h])=>console.log(`    ${d}: ${h.join(', ')}`));
      });
    }
    return;
  }

  if (!SUPA_KEY) { console.error('❌ SUPABASE_SERVICE_KEY manquante'); process.exit(1); }
  await pushToSupabase(allData);
  console.log('\n✅ Terminé.');
}

main().catch(e => { console.error('❌ Fatal:', e); process.exit(1); });
