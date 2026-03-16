/**
 * CinéMatch — Scraper v8
 * Source: API JSON AlloCiné directe (découverte par interception réseau)
 * URL: https://www.allocine.fr/_/showtimes/theater-{id}/d-{date}/
 * Pas de Playwright, pas de Didomi — simple fetch !
 */

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

function getDateISO(n = 0) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function slugify(t) {
  return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}

function toHeure(s) {
  if (!s) return null;
  const mISO = String(s).match(/T(\d{2}):(\d{2})/);
  if (mISO) { const h = parseInt(mISO[1]); if (h >= 6 && h <= 23) return `${h}h${mISO[2]}`; }
  const mTxt = String(s).match(/(\d{1,2})[h:](\d{2})/i);
  if (mTxt) { const h = parseInt(mTxt[1]); if (h >= 6 && h <= 23) return `${h}h${mTxt[2]}`; }
  return null;
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'fr-FR,fr;q=0.9',
  'Referer': 'https://www.allocine.fr/',
  'X-Requested-With': 'XMLHttpRequest',
};

// ── API ALLOCINE DIRECTE ───────────────────────────────────────────────────────
async function fetchShowtimes(allocineId, dateISO, debugFirst = false) {
  const url = `https://www.allocine.fr/_/showtimes/theater-${allocineId}/d-${dateISO}/`;
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    if (json.error && json.results?.length === 0) return []; // pas de séances ce jour

    if (debugFirst) {
      // Afficher la structure complète du premier film pour comprendre le schéma
      const first = json.results?.[0];
      if (first) {
        console.log(`    🔍 Structure premier film:`);
        console.log(`       Clés: ${Object.keys(first).join(', ')}`);
        console.log(`       movie clés: ${Object.keys(first.movie || {}).join(', ')}`);
        // Chercher les horaires
        const stKeys = Object.keys(first).filter(k => k !== 'movie');
        stKeys.forEach(k => {
          const v = first[k];
          if (Array.isArray(v) && v.length > 0) {
            console.log(`       ${k}[0] clés: ${Object.keys(v[0]).join(', ')}`);
            console.log(`       ${k}[0]: ${JSON.stringify(v[0]).slice(0, 150)}`);
          }
        });
      }
    }

    const seances = [];
    for (const item of (json.results || [])) {
      const movie = item.movie || {};
      const title = movie.title || movie.originalTitle;
      if (!title) continue;

      const director = movie.directors?.[0]?.name || movie.directors?.[0] || '';
      const duration = movie.runtime ? `${Math.floor(movie.runtime/60)}h${String(movie.runtime%60).padStart(2,'0')}` : '';
      const genre = movie.genres?.[0]?.tag || movie.genres?.[0] || '';

      // Chercher les horaires dans toutes les clés possibles de item
      const heures = [];
      const showtimeKeys = ['showtimes', 'shows', 'screenings', 'times', 'sessions', 'versions'];

      for (const key of Object.keys(item)) {
        if (key === 'movie') continue;
        const val = item[key];
        // Si c'est un tableau de séances
        if (Array.isArray(val)) {
          for (const show of val) {
            const t = show?.startsAt || show?.startAt || show?.time || show?.datetime || show?.start;
            const h = toHeure(t);
            if (h) heures.push(h);
            // Parfois les séances sont imbriquées dans une liste
            if (Array.isArray(show?.showtimes)) {
              for (const s of show.showtimes) {
                const h2 = toHeure(s?.startsAt || s?.time || s);
                if (h2) heures.push(h2);
              }
            }
          }
        }
        // Si c'est un objet avec des listes par version (VF/VO/etc)
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
          for (const versionList of Object.values(val)) {
            if (Array.isArray(versionList)) {
              for (const show of versionList) {
                const t = show?.startsAt || show?.time || show?.start;
                const h = toHeure(t);
                if (h) heures.push(h);
              }
            }
          }
        }
      }

      if (heures.length > 0) {
        seances.push({ title, director, duration, genre, heures: [...new Set(heures)].sort() });
      }
    }
    return seances;
  } catch (e) {
    console.log(`    ✗ API ${allocineId} ${dateISO}: ${e.message}`);
    return [];
  }
}

// ── SCRAPE UN CINÉMA ──────────────────────────────────────────────────────────
async function scrapeCinema(cinemaId, cinema) {
  console.log(`\n📍 ${cinemaId} (${cinema.allocineId})...`);
  const result = { films: {}, seances: {} };
  let firstDebug = true;

  for (let day = 0; day < DAYS; day++) {
    const dateISO = getDateISO(day);
    const seances = await fetchShowtimes(cinema.allocineId, dateISO, firstDebug && day === 0);
    firstDebug = false;

    for (const { title, director, duration, genre, heures } of seances) {
      if (!result.films[title]) result.films[title] = { title, director, duration, genre };
      if (!result.seances[title]) result.seances[title] = {};
      result.seances[title][dateISO] = heures;
    }

    console.log(`    ✓ ${dateISO}: ${seances.length} films${seances[0] ? ` — ex: "${seances[0].title}" ${seances[0].heures.join(', ')}` : ''}`);
    await sleep(300);
  }

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
        const t = vids?.find(v=>v.type==='Trailer'&&v.site==='YouTube') || vids?.find(v=>v.site==='YouTube');
        if (t) film.trailerKey = t.key;
      }
      console.log(`  ✓ "${film.title}" → ${movie.id}${film.trailerKey?' + 🎬':''}`);
      await sleep(200);
    } catch (e) { console.log(`  ✗ "${film.title}": ${e.message}`); }
  }
}

// ── SUPABASE ──────────────────────────────────────────────────────────────────
async function pushToSupabase(allData) {
  console.log('\n📤 Push Supabase...');
  await supa.from('cinemas_dyn').upsert(
    Object.entries(CINEMAS).map(([id,c])=>({
      id, name:c.name, chain:c.chain, lat:c.lat, lng:c.lng, addr:c.addr, metro:c.metro, salles:c.salles,
    })), { onConflict:'id' }
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
    const chunk = Object.entries(allFilms).slice(i, i+50);
    await supa.from('films_dyn').upsert(
      chunk.map(([slug,f])=>({
        id:slug, title:f.title, director:f.director||'', duration:f.duration||'',
        genre:f.genre||'', synopsis:f.synopsis||'', poster_url:f.poster||null,
        tmdb_id:f.tmdbId||null, tmdb_note:f.tmdbNote||null, trailer_key:f.trailerKey||null,
        updated_at:new Date().toISOString(),
      })), { onConflict:'id' }
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
  console.log('🎬 CinéMatch Scraper v8 — ' + new Date().toLocaleString('fr-FR'));
  console.log(DRY_RUN ? '🔍 DRY-RUN' : '🚀 PRODUCTION');

  const allData = {};
  for (const [id, cinema] of Object.entries(CINEMAS)) {
    allData[id] = await scrapeCinema(id, cinema);
    const nf = Object.keys(allData[id].films).length;
    const ns = Object.values(allData[id].seances).reduce((s,d)=>s+Object.values(d).reduce((a,h)=>a+h.length,0),0);
    console.log(`  ${nf>0?'✓':'✗'} ${id}: ${nf} films, ${ns} séances`);
    await sleep(400);
  }

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
