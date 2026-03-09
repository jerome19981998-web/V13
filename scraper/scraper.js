/**
 * CinéMatch — Scraper v3
 * 
 * Sources:
 *  - API AlloCiné v3 (JSON) pour Pathé + Gaumont
 *  - API UGC (JSON) pour les cinémas UGC
 * 
 * Usage:
 *   node scraper.js           → scrape + push Supabase
 *   node scraper.js --dry-run → scrape + affiche sans push
 */

const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');
const DAYS = 3; // Seulement 3 jours (les séances sont souvent publiées tard)

// ─── CONFIG ─────────────────────────────────────────────────────────────────
const SUPA_URL = process.env.SUPABASE_URL || 'https://alwfbminhdwinxcozjlj.supabase.co';
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY;
const TMDB_TOKEN = process.env.TMDB_TOKEN || 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIzMzY0M2EwMDRiZGMyYzdlNmIyYTFjOWMzZWI5ZDhlYyIsIm5iZiI6MTc3MzAwMTIzNy42ODYsInN1YiI6IjY5YWRkYTE1MmVmNWMxZmY5NWZjYmNlOCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.bRW2UVqu1p89xPusKV5-mzW4ZeRSk8ij811FWOIwoBM';
const supa = !DRY_RUN && SUPA_KEY ? createClient(SUPA_URL, SUPA_KEY) : null;

// ─── MAPPING CINÉMAS ─────────────────────────────────────────────────────────
// allocineId = code AlloCiné (pour API v3 + Pathé/Gaumont)
// ugcId      = code interne UGC (pour API UGC)
const CINEMAS = {
  'ugc-halles':            { name: 'UGC Ciné Cité Les Halles',    chain: 'ugc',     lat: 48.8609, lng: 2.3474, addr: '7 pl. de la Rotonde',       metro: 'Les Halles',      allocineId: 'P0647', ugcId: 35 },
  'ugc-bercy':             { name: 'UGC Ciné Cité Bercy',          chain: 'ugc',     lat: 48.8302, lng: 2.3789, addr: '2 cour Saint-Émilion',      metro: 'Cour St-Émilion', allocineId: 'P0648', ugcId: 36 },
  'ugc-paris19':           { name: 'UGC Ciné Cité Paris 19',       chain: 'ugc',     lat: 48.8866, lng: 2.3780, addr: '1 rue du Bassin',           metro: 'Corentin Cariou', allocineId: 'P0649', ugcId: 37 },
  'ugc-maillot':           { name: 'UGC Maillot',                  chain: 'ugc',     lat: 48.8794, lng: 2.2830, addr: '2 pl. Porte Maillot',       metro: 'Porte Maillot',   allocineId: 'P0650', ugcId: 38 },
  'ugc-opera':             { name: 'UGC Opéra',                    chain: 'ugc',     lat: 48.8719, lng: 2.3387, addr: '34 bd des Italiens',        metro: 'Opéra',           allocineId: 'P0645', ugcId: 33 },
  'ugc-danton':            { name: 'UGC Danton',                   chain: 'ugc',     lat: 48.8527, lng: 2.3411, addr: '99 bd du Montparnasse',     metro: 'Vavin',           allocineId: 'P0646', ugcId: 34 },
  'ugc-montparnasse':      { name: 'UGC Montparnasse',              chain: 'ugc',     lat: 48.8424, lng: 2.3244, addr: '103 bd du Montparnasse',    metro: 'Vavin',           allocineId: 'P0651', ugcId: 39 },
  'ugc-lyon':              { name: 'UGC Lyon-Bastille',             chain: 'ugc',     lat: 48.8448, lng: 2.3731, addr: '12 rue de Lyon',            metro: 'Gare de Lyon',    allocineId: 'P0652', ugcId: 40 },
  'pathe-beaugrenelle':    { name: 'Pathé Beaugrenelle',            chain: 'pathe',   lat: 48.8473, lng: 2.2894, addr: '7 rue Linois',              metro: 'Charles Michels', allocineId: 'P0614' },
  'pathe-convention':      { name: 'Pathé Convention',              chain: 'pathe',   lat: 48.8396, lng: 2.3087, addr: '27 rue Alain-Chartier',     metro: 'Convention',      allocineId: 'P0617' },
  'pathe-parnasse':        { name: 'Pathé Parnasse',                chain: 'pathe',   lat: 48.8429, lng: 2.3334, addr: '3 rue du Départ',           metro: 'Montparnasse',    allocineId: 'P0618' },
  'pathe-wepler':          { name: 'Pathé Wepler',                  chain: 'pathe',   lat: 48.8842, lng: 2.3272, addr: '14 pl. de Clichy',          metro: 'Place de Clichy', allocineId: 'P0615' },
  'pathe-alesia':          { name: 'Pathé Alésia',                  chain: 'pathe',   lat: 48.8272, lng: 2.3264, addr: '73 av. du Gal Leclerc',     metro: 'Alésia',          allocineId: 'P0616' },
  'pathe-batignolles':     { name: 'Les 7 Batignolles',             chain: 'pathe',   lat: 48.8861, lng: 2.3189, addr: '6 rue Hélène',              metro: 'Brochant',        allocineId: 'P0613' },
  'gaumont-opera':         { name: 'Gaumont Opéra Premier',         chain: 'gaumont', lat: 48.8701, lng: 2.3308, addr: '2 bd des Capucines',        metro: 'Opéra',           allocineId: 'P0573' },
  'gaumont-convention':    { name: 'Gaumont Convention',            chain: 'gaumont', lat: 48.8392, lng: 2.3089, addr: '27 rue Alain-Chartier',     metro: 'Convention',      allocineId: 'P0574' },
  'gaumont-aquaboulevard': { name: 'Gaumont Aquaboulevard',         chain: 'gaumont', lat: 48.8314, lng: 2.2783, addr: '8 rue Colonel Pierre Avia', metro: 'Balard',          allocineId: 'P0575' },
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

function toHeure(str) {
  if (!str) return null;
  // "14:30" ou "14h30" ou "2026-03-09T14:30:00"
  const match = String(str).match(/(\d{1,2})[h:Th](\d{2})/i);
  if (!match) return null;
  return `${match[1]}h${match[2]}`;
}

function getDateISO(daysFromNow = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

// ─── API ALLOCINÉ v3 ──────────────────────────────────────────────────────────
// API officielle de l'app mobile AlloCiné, retourne du JSON propre
const ALLOCINE_PARTNER = 'QUNXZWItQWxsb0Npbuk'; // clé publique app Android

async function fetchAllocineJSON(allocineId, dateISO) {
  const url = `https://api.allocine.fr/rest/v3/showtimelist?partner=${ALLOCINE_PARTNER}&format=json&theaters=${allocineId}&date=${dateISO}&count=20`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 9; SM-G960F Build/PPR1.180610.011)',
        'Accept': 'application/json',
      },
      timeout: 10000,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch(e) {
    console.log(`  ⚠ AlloCiné API échouée pour ${allocineId}/${dateISO}: ${e.message}`);
    return null;
  }
}

function parseAllocineResponse(json) {
  // Structure: { feed: { theaterShowtimes: [ { onShowtimeList: [ { movie, scr:[ {d:'HH:MM'} ] } ] } ] } }
  const theaters = json?.feed?.theaterShowtimes;
  if (!theaters?.length) return [];

  const results = [];
  for (const theater of theaters) {
    for (const item of (theater.onShowtimeList || [])) {
      const movie = item.movie || {};
      const title = movie.title;
      if (!title) continue;

      const director = (movie.castingShort?.directors || '').replace(/^de\s+/i, '');
      const runtime = movie.runtime; // en secondes
      const duration = runtime ? `${Math.floor(runtime/3600)}h${String(Math.floor((runtime%3600)/60)).padStart(2,'0')}` : '';
      const genre = (movie.genre || []).map(g => g.$).join(', ');
      const synopsis = movie.synopsisShort || movie.synopsis || '';
      const allocineFilmCode = movie.code;

      const heures = [];
      for (const scr of (item.scr || [])) {
        for (const show of (scr.d || [])) {
          const t = typeof show === 'string' ? show : (show.$ || show.time || '');
          const h = toHeure(t);
          if (h && !heures.includes(h)) heures.push(h);
        }
      }

      results.push({ title, director, duration, genre, synopsis, allocineFilmCode, heures });
    }
  }
  return results;
}

// ─── API UGC ──────────────────────────────────────────────────────────────────
// API non documentée utilisée par le site web UGC (retourne JSON)
async function fetchUGCSeances(ugcId, dateISO) {
  // D'abord récupérer le code de date UGC
  const timestamp = new Date(dateISO + 'T00:00:00').getTime();
  const url = `https://www.ugc.fr/resaExpressAction!getSeanceList.action?region=&cinema=${ugcId}&film=&date=${timestamp}&seance=`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        'Accept': 'application/json, text/javascript',
        'Referer': 'https://www.ugc.fr/',
        'X-Requested-With': 'XMLHttpRequest',
      },
      timeout: 10000,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json;
  } catch(e) {
    console.log(`  ⚠ UGC API échouée pour ugcId=${ugcId}/${dateISO}: ${e.message}`);
    return null;
  }
}

function parseUGCResponse(json) {
  // Structure UGC: { seances: { "filmId": "heure1|heure2|..." } }
  // + { films: { "filmId": "Titre du film" } }
  if (!json?.seances) return [];

  const results = [];
  const films = json.films || {};
  const seances = json.seances;

  for (const [filmId, heuresStr] of Object.entries(seances)) {
    const title = films[filmId] || `Film ${filmId}`;
    const heures = String(heuresStr).split('|')
      .map(h => toHeure(h.trim()))
      .filter(h => h && /^\d{1,2}h\d{2}$/.test(h));
    
    if (heures.length > 0) {
      results.push({ title, heures, ugcFilmId: filmId });
    }
  }
  return results;
}

// ─── SCRAPING PRINCIPAL ───────────────────────────────────────────────────────
async function scrapeCinema(cinemaId, cinema) {
  console.log(`\n📍 ${cinemaId} (${cinema.chain.toUpperCase()})...`);

  const result = { films: {}, seances: {} };

  for (let day = 0; day < DAYS; day++) {
    const dateISO = getDateISO(day);
    console.log(`  📅 ${dateISO}`);

    let seancesJour = [];

    if (cinema.chain === 'ugc' && cinema.ugcId) {
      // ── UGC : API dédiée ──
      const json = await fetchUGCSeances(cinema.ugcId, dateISO);
      if (json) {
        seancesJour = parseUGCResponse(json);
        console.log(`     UGC API: ${seancesJour.length} films`);
      }
      // Fallback AlloCiné si UGC API échoue
      if (!seancesJour.length) {
        const json2 = await fetchAllocineJSON(cinema.allocineId, dateISO);
        if (json2) {
          seancesJour = parseAllocineResponse(json2);
          console.log(`     AlloCiné fallback: ${seancesJour.length} films`);
        }
      }
    } else {
      // ── Pathé / Gaumont : API AlloCiné v3 ──
      const json = await fetchAllocineJSON(cinema.allocineId, dateISO);
      if (json) {
        seancesJour = parseAllocineResponse(json);
        console.log(`     AlloCiné API: ${seancesJour.length} films`);
      }
    }

    // Stocker les résultats
    for (const { title, director, duration, genre, synopsis, heures } of seancesJour) {
      if (!title || !heures.length) continue;

      if (!result.films[title]) {
        result.films[title] = { title, director: director||'', duration: duration||'', genre: genre||'', synopsis: synopsis||'' };
      }
      if (!result.seances[title]) result.seances[title] = {};
      result.seances[title][dateISO] = [...new Set(heures)].sort();
    }

    const totalH = Object.values(result.seances).reduce((s, fd) => s + (fd[dateISO]||[]).length, 0);
    console.log(`     ✓ ${seancesJour.length} films, ${totalH} horaires`);

    await sleep(400);
  }

  return result;
}

// ─── ENRICHISSEMENT TMDB ──────────────────────────────────────────────────────
async function enrichWithTMDB(films) {
  console.log('\n🎬 Enrichissement TMDB...');
  for (const [slug, film] of Object.entries(films)) {
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(film.title)}&language=fr-FR&region=FR`,
        { headers: { Authorization: `Bearer ${TMDB_TOKEN}` }, timeout: 8000 }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const movie = data.results?.[0];
      if (!movie) continue;

      film.tmdbId = movie.id;
      film.poster = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null;
      film.tmdbNote = movie.vote_average ? Math.round(movie.vote_average * 10) / 10 : null;
      if (!film.synopsis && movie.overview) film.synopsis = movie.overview;

      // Bande-annonce
      const vRes = await fetch(
        `https://api.themoviedb.org/3/movie/${movie.id}/videos?language=fr-FR`,
        { headers: { Authorization: `Bearer ${TMDB_TOKEN}` }, timeout: 8000 }
      );
      if (vRes.ok) {
        const vData = await vRes.json();
        const trailer = vData.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube')
                     || vData.results?.find(v => v.site === 'YouTube');
        if (trailer) film.trailerKey = trailer.key;
      }

      console.log(`  ✓ "${film.title}" → TMDB ${movie.id}${film.trailerKey ? ' + trailer' : ''}`);
      await sleep(250);
    } catch(e) {
      console.warn(`  ⚠ TMDB échoué pour "${film.title}": ${e.message}`);
    }
  }
  return films;
}

// ─── PUSH SUPABASE ────────────────────────────────────────────────────────────
async function pushToSupabase(allData) {
  console.log('\n📤 Push vers Supabase...');

  // 1. Cinémas
  const cinemasRows = Object.entries(CINEMAS).map(([id, c]) => ({
    id, name: c.name, chain: c.chain, lat: c.lat, lng: c.lng,
    addr: c.addr, metro: c.metro, allocine_id: c.allocineId,
  }));
  const { error: cErr } = await supa.from('cinemas_dyn').upsert(cinemasRows, { onConflict: 'id' });
  if (cErr) console.error('Erreur cinémas:', cErr.message);
  else console.log(`  ✓ ${cinemasRows.length} cinémas`);

  // 2. Films uniques
  const allFilms = {};
  for (const { films } of Object.values(allData)) {
    for (const [title, f] of Object.entries(films)) {
      const slug = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
                        .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      if (!allFilms[slug]) allFilms[slug] = { ...f, slug };
    }
  }

  await enrichWithTMDB(allFilms);

  const filmsRows = Object.entries(allFilms).map(([slug, f]) => ({
    id: slug, title: f.title, director: f.director||'', duration: f.duration||'',
    genre: f.genre||'', synopsis: f.synopsis||'', poster_url: f.poster||null,
    tmdb_id: f.tmdbId||null, tmdb_note: f.tmdbNote||null, trailer_key: f.trailerKey||null,
    updated_at: new Date().toISOString(),
  }));
  const { error: fErr } = await supa.from('films_dyn').upsert(filmsRows, { onConflict: 'id' });
  if (fErr) console.error('Erreur films:', fErr.message);
  else console.log(`  ✓ ${filmsRows.length} films`);

  // 3. Séances
  const today = getDateISO();
  await supa.from('seances_dyn').delete().lt('date', today);

  const seancesRows = [];
  for (const [cinemaId, { seances, films }] of Object.entries(allData)) {
    for (const [title, dateMap] of Object.entries(seances)) {
      const slug = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
                        .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      for (const [date, heures] of Object.entries(dateMap)) {
        if (!heures.length) continue;
        seancesRows.push({ cinema_id: cinemaId, film_id: slug, date, heures });
      }
    }
  }

  for (let i = 0; i < seancesRows.length; i += 100) {
    const { error: sErr } = await supa.from('seances_dyn')
      .upsert(seancesRows.slice(i, i+100), { onConflict: 'cinema_id,film_id,date' });
    if (sErr) console.error(`Erreur séances:`, sErr.message);
  }
  console.log(`  ✓ ${seancesRows.length} séances`);
  console.log(`\n✅ Terminé : ${filmsRows.length} films, ${seancesRows.length} séances sur ${DAYS} jours`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🎬 CinéMatch Scraper v3 — ' + new Date().toLocaleString('fr-FR'));
  console.log(DRY_RUN ? '🔍 MODE DRY-RUN' : '🚀 MODE PRODUCTION');
  console.log(`📅 Scraping ${DAYS} jours : ${getDateISO(0)} → ${getDateISO(DAYS-1)}`);
  console.log('─'.repeat(50));

  const allData = {};
  for (const [cinemaId, cinema] of Object.entries(CINEMAS)) {
    try {
      allData[cinemaId] = await scrapeCinema(cinemaId, cinema);
    } catch(e) {
      console.error(`❌ ${cinemaId}:`, e.message);
      allData[cinemaId] = { films: {}, seances: {} };
    }
    await sleep(300);
  }

  // Résumé
  console.log('\n' + '─'.repeat(50));
  let totalFilms = new Set(), totalSeances = 0;
  for (const [cid, data] of Object.entries(allData)) {
    const nf = Object.keys(data.films).length;
    const ns = Object.values(data.seances).reduce((s,fd) => s + Object.values(fd).reduce((a,h) => a+h.length,0), 0);
    Object.keys(data.films).forEach(t => totalFilms.add(t));
    totalSeances += ns;
    if (nf > 0) console.log(`  ✓ ${cid}: ${nf} films, ${ns} séances`);
    else console.log(`  ✗ ${cid}: 0 résultat`);
  }
  console.log(`\n📊 TOTAL: ${totalFilms.size} films uniques, ${totalSeances} séances`);

  if (DRY_RUN) {
    // Afficher un exemple
    const exemple = Object.entries(allData).find(([,d]) => Object.keys(d.films).length > 0);
    if (exemple) {
      const [cid, data] = exemple;
      console.log(`\n🔍 Exemple (${cid}):`);
      Object.entries(data.seances).slice(0, 3).forEach(([title, dates]) => {
        console.log(`  "${title}" :`);
        Object.entries(dates).forEach(([d, h]) => console.log(`    ${d}: ${h.join(', ')}`));
      });
    }
    return;
  }

  if (!SUPA_KEY) { console.error('❌ SUPABASE_SERVICE_KEY manquante'); process.exit(1); }
  await pushToSupabase(allData);
}

main().catch(e => { console.error('❌ Fatal:', e); process.exit(1); });
