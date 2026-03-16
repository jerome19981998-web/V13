/**
 * CinéMatch — Scraper v6
 *
 * Sources :
 * - UGC  : API JSON non-officielle (ugc.fr/resaExpressAction)
 * - Pathé/Gaumont : API JSON de leur site (pathe.fr)
 * - TMDB : enrichissement posters/notes/trailers
 *
 * Plus de Playwright — node-fetch suffit — fonctionne sur GitHub Actions
 */

const fetch  = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');
const DAYS    = 7;

const SUPA_URL   = process.env.SUPABASE_URL         || 'https://alwfbminhdwinxcozjlj.supabase.co';
const SUPA_KEY   = process.env.SUPABASE_SERVICE_KEY;
const TMDB_TOKEN = process.env.TMDB_TOKEN           || 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIzMzY0M2EwMDRiZGMyYzdlNmIyYTFjOWMzZWI5ZDhlYyIsIm5iZiI6MTc3MzAwMTIzNy42ODYsInN1YiI6IjY5YWRkYTE1MmVmNWMxZmY5NWZjYmNlOCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.bRW2UVqu1p89xPusKV5-mzW4ZeRSk8ij811FWOIwoBM';

const supa = !DRY_RUN && SUPA_KEY ? createClient(SUPA_URL, SUPA_KEY) : null;

const CINEMAS = {
  'ugc-halles':            { name: 'UGC Ciné Cité Les Halles',    chain: 'ugc',     lat: 48.8609, lng: 2.3474, addr: '7 pl. de la Rotonde',          metro: 'Les Halles',      ugcId: '41', salles: 27 },
  'ugc-bercy':             { name: 'UGC Ciné Cité Bercy',          chain: 'ugc',     lat: 48.8302, lng: 2.3789, addr: '2 cour Saint-Émilion',         metro: 'Cour St-Émilion', ugcId: '32', salles: 18 },
  'ugc-paris19':           { name: 'UGC Ciné Cité Paris 19',       chain: 'ugc',     lat: 48.8866, lng: 2.3780, addr: '166 bd Macdonald',             metro: 'Corentin Cariou', ugcId: '44', salles: 19 },
  'ugc-maillot':           { name: 'UGC Maillot',                  chain: 'ugc',     lat: 48.8794, lng: 2.2830, addr: '2 pl. Porte Maillot',          metro: 'Porte Maillot',   ugcId: '37', salles: 9  },
  'ugc-opera':             { name: 'UGC Opéra',                    chain: 'ugc',     lat: 48.8719, lng: 2.3387, addr: '34 bd des Italiens',           metro: 'Opéra',           ugcId: '39', salles: 7  },
  'ugc-danton':            { name: 'UGC Danton',                   chain: 'ugc',     lat: 48.8527, lng: 2.3411, addr: '99 bd du Montparnasse',        metro: 'Vavin',           ugcId: '33', salles: 6  },
  'ugc-montparnasse':      { name: 'UGC Montparnasse',              chain: 'ugc',     lat: 48.8424, lng: 2.3244, addr: '83 bd du Montparnasse',        metro: 'Vavin',           ugcId: '38', salles: 5  },
  'ugc-lyon':              { name: 'UGC Lyon-Bastille',             chain: 'ugc',     lat: 48.8448, lng: 2.3731, addr: '12 rue de Lyon',               metro: 'Gare de Lyon',    ugcId: '36', salles: 6  },
  'pathe-beaugrenelle':    { name: 'Pathé Beaugrenelle',            chain: 'pathe',   lat: 48.8473, lng: 2.2894, addr: '7 rue Linois',                 metro: 'Charles Michels', patheId: 'pathe-beaugrenelle',    salles: 13 },
  'pathe-convention':      { name: 'Pathé Convention',              chain: 'pathe',   lat: 48.8396, lng: 2.3087, addr: '27 rue Alain-Chartier',        metro: 'Convention',      patheId: 'pathe-convention',      salles: 14 },
  'pathe-parnasse':        { name: 'Pathé Parnasse',                chain: 'pathe',   lat: 48.8429, lng: 2.3334, addr: "3 rue d'Odessa",               metro: 'Montparnasse',    patheId: 'pathe-parnasse',        salles: 7  },
  'pathe-wepler':          { name: 'Pathé Wepler',                  chain: 'pathe',   lat: 48.8842, lng: 2.3272, addr: '140 bd de Clichy',             metro: 'Place de Clichy', patheId: 'pathe-wepler',          salles: 10 },
  'pathe-alesia':          { name: 'Pathé Alésia',                  chain: 'pathe',   lat: 48.8272, lng: 2.3264, addr: '73 av. du Gal Leclerc',        metro: 'Alésia',          patheId: 'pathe-alesia',          salles: 8  },
  'pathe-batignolles':     { name: 'Les 7 Batignolles',             chain: 'pathe',   lat: 48.8996, lng: 2.3133, addr: '25 allée Colette Heilbronner', metro: 'Porte de Clichy', patheId: 'les-7-batignolles',     salles: 7  },
  'gaumont-opera':         { name: 'Gaumont Opéra (Capucines)',     chain: 'gaumont', lat: 48.8701, lng: 2.3308, addr: '2 bd des Capucines',           metro: 'Opéra',           patheId: 'gaumont-opera-capucines', salles: 9 },
  'gaumont-convention':    { name: 'Gaumont Convention',            chain: 'gaumont', lat: 48.8392, lng: 2.3089, addr: '27 rue Alain-Chartier',        metro: 'Convention',      patheId: 'gaumont-convention',    salles: 14 },
  'gaumont-aquaboulevard': { name: 'Gaumont Aquaboulevard',         chain: 'gaumont', lat: 48.8314, lng: 2.2783, addr: '8 rue Colonel Pierre Avia',    metro: 'Balard',          patheId: 'gaumont-aquaboulevard', salles: 15 },
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

function toHeure(s) {
  if (!s) return null;
  const mISO = String(s).match(/T(\d{2}):(\d{2})/);
  if (mISO) { const h = parseInt(mISO[1]); if (h >= 6 && h <= 23) return `${h}h${mISO[2]}`; }
  const mTxt = String(s).match(/(\d{1,2})[h:](\d{2})/i);
  if (mTxt) { const h = parseInt(mTxt[1]); if (h >= 6 && h <= 23) return `${h}h${mTxt[2]}`; }
  return null;
}

function getDateISO(n = 0) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function slugify(t) {
  return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  'Accept': 'application/json',
  'Accept-Language': 'fr-FR,fr;q=0.9',
};

async function fetchJSON(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS, timeout: 15000 });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i < retries - 1) await sleep(2000);
    }
  }
  return null;
}

// ── UGC : API JSON non-officielle ─────────────────────────────────────────────
async function scrapeUGC(cinemaId, cinema) {
  const films = {}, seances = {};
  const id = cinema.ugcId;

  const filmsData = await fetchJSON(`https://www.ugc.fr/resaExpressAction!getFilmList.action?region=&cinema=${id}&film=&date=&seance=`);
  if (!filmsData?.films) { console.log(`    ✗ UGC films vide`); return { films, seances }; }

  const datesData = await fetchJSON(`https://www.ugc.fr/resaExpressAction!getDateList.action?region=&cinema=${id}&film=&date=&seance=`);
  const dates = Object.entries(datesData?.dates || {}).slice(0, DAYS);

  for (const [dateCode, dateLabel] of dates) {
    let dateISO;
    if (/^\d{13}$/.test(dateCode)) {
      dateISO = new Date(parseInt(dateCode)).toISOString().slice(0, 10);
    } else {
      const m = String(dateLabel).match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (!m) continue;
      dateISO = `${m[3]}-${m[2]}-${m[1]}`;
    }

    for (const [filmCode, filmTitle] of Object.entries(filmsData.films)) {
      const s = await fetchJSON(`https://www.ugc.fr/resaExpressAction!getSeanceList.action?region=&cinema=${id}&film=${filmCode}&date=${dateCode}&seance=`);
      if (!s?.seances) continue;
      const heures = Object.values(s.seances).map(toHeure).filter(Boolean).sort();
      if (!heures.length) continue;
      if (!films[filmTitle]) films[filmTitle] = { title: filmTitle, director: '', duration: '', genre: '' };
      if (!seances[filmTitle]) seances[filmTitle] = {};
      seances[filmTitle][dateISO] = [...new Set([...(seances[filmTitle][dateISO]||[]), ...heures])];
      await sleep(100);
    }
    await sleep(300);
  }

  return { films, seances };
}

// ── PATHÉ / GAUMONT : API JSON officielle ─────────────────────────────────────
async function scrapePathe(cinemaId, cinema) {
  const films = {}, seances = {};
  const pid = cinema.patheId;

  for (let day = 0; day < DAYS; day++) {
    const dateISO = getDateISO(day);

    // Essayer plusieurs formats d'URL de l'API Pathé
    const urls = [
      `https://www.pathe.fr/api/cinema/sessions/${pid}?date=${dateISO}`,
      `https://www.pathe.fr/api/showtimes/cinemas/${pid}?date=${dateISO}`,
      `https://www.pathe.fr/cinema/${pid}/seances?date=${dateISO}`,
    ];

    let data = null;
    for (const url of urls) {
      data = await fetchJSON(url);
      if (data) break;
      await sleep(200);
    }

    if (!data) { console.log(`    ✗ Pathé: pas de réponse ${pid} ${dateISO}`); continue; }

    const movies = data.movies || data.films || data.showtimes || data.results || data.data || [];
    const list = Array.isArray(movies) ? movies : Object.values(movies);

    for (const movie of list) {
      const title = movie.title || movie.titre || movie.name;
      if (!title) continue;

      const heures = [];
      const times = movie.showtimes || movie.seances || movie.sessions || movie.times || [];
      for (const t of (Array.isArray(times) ? times : Object.values(times))) {
        const h = toHeure(t.time || t.heure || t.startTime || t.start || t);
        if (h) heures.push(h);
      }
      if (!heures.length) continue;

      if (!films[title]) films[title] = {
        title,
        director: movie.director || movie.realisateur || '',
        duration: movie.duration || movie.duree || '',
        genre: movie.genre || movie.genres?.[0] || '',
      };
      if (!seances[title]) seances[title] = {};
      seances[title][dateISO] = [...new Set([...(seances[title][dateISO]||[]), ...heures.sort()])];
    }

    await sleep(400);
  }

  return { films, seances };
}

// ── TMDB ──────────────────────────────────────────────────────────────────────
const TMDB_GENRES = { 28:'Action',12:'Aventure',16:'Animation',35:'Comédie',80:'Polar',99:'Documentaire',18:'Drame',14:'Fantastique',27:'Horreur',10749:'Romance',878:'Sci-Fi',53:'Thriller',10752:'Guerre',36:'Biopic' };

async function searchTMDB(title, year) {
  const p = new URLSearchParams({ query: title, language: 'fr-FR', region: 'FR' });
  if (year) p.set('primary_release_year', String(year));
  const res = await fetch(`https://api.themoviedb.org/3/search/movie?${p}`, { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } });
  if (!res.ok) return null;
  const { results } = await res.json();
  return results?.[0] || null;
}

async function enrichWithTMDB(films) {
  console.log('\n🎬 Enrichissement TMDB...');
  const year = new Date().getFullYear();
  for (const film of Object.values(films)) {
    try {
      const movie = await searchTMDB(film.title, year) || await searchTMDB(film.title, year-1) || await searchTMDB(film.title, null);
      if (!movie) { console.log(`  ✗ "${film.title}"`); continue; }
      film.tmdbId = movie.id;
      film.poster = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null;
      film.tmdbNote = movie.vote_average ? +movie.vote_average.toFixed(1) : null;
      film.synopsis = movie.overview || '';
      if (!film.genre && movie.genre_ids?.[0]) film.genre = TMDB_GENRES[movie.genre_ids[0]] || '';
      const vr = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}/videos?language=fr-FR`, { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } });
      if (vr.ok) { const { results: vids } = await vr.json(); const t = vids?.find(v=>v.type==='Trailer'&&v.site==='YouTube')||vids?.find(v=>v.site==='YouTube'); if (t) film.trailerKey = t.key; }
      console.log(`  ✓ "${film.title}" → ${movie.id}${film.trailerKey?' + 🎬':''}`);
      await sleep(200);
    } catch (e) { console.log(`  ✗ "${film.title}": ${e.message}`); }
  }
}

// ── SUPABASE ──────────────────────────────────────────────────────────────────
async function pushToSupabase(allData) {
  console.log('\n📤 Push Supabase...');

  await supa.from('cinemas_dyn').upsert(
    Object.entries(CINEMAS).map(([id,c])=>({ id, name:c.name, chain:c.chain, lat:c.lat, lng:c.lng, addr:c.addr, metro:c.metro, salles:c.salles })),
    { onConflict: 'id' }
  );

  const allFilms = {};
  for (const { films } of Object.values(allData)) {
    for (const [title, f] of Object.entries(films)) {
      const slug = slugify(title);
      if (!allFilms[slug]) allFilms[slug] = { ...f, slug };
    }
  }
  await enrichWithTMDB(allFilms);

  const filmRows = Object.entries(allFilms).map(([slug,f])=>({
    id: slug, title: f.title, director: f.director||'', duration: f.duration||'',
    genre: f.genre||'', synopsis: f.synopsis||'', poster_url: f.poster||null,
    tmdb_id: f.tmdbId||null, tmdb_note: f.tmdbNote||null, trailer_key: f.trailerKey||null,
    updated_at: new Date().toISOString(),
  }));
  for (let i=0; i<filmRows.length; i+=50) {
    await supa.from('films_dyn').upsert(filmRows.slice(i,i+50), { onConflict: 'id' });
  }
  console.log(`  ✓ ${filmRows.length} films`);

  await supa.from('seances_dyn').delete().lt('date', getDateISO(0));
  const rows = [];
  for (const [cinemaId, { seances }] of Object.entries(allData)) {
    for (const [title, dateMap] of Object.entries(seances)) {
      const slug = slugify(title);
      for (const [date, heures] of Object.entries(dateMap)) {
        if (heures.length) rows.push({ cinema_id: cinemaId, film_id: slug, date, heures });
      }
    }
  }
  for (let i=0; i<rows.length; i+=100) {
    await supa.from('seances_dyn').upsert(rows.slice(i,i+100), { onConflict: 'cinema_id,film_id,date' });
  }
  console.log(`  ✓ ${rows.length} séances`);
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🎬 CinéMatch Scraper v6 — ' + new Date().toLocaleString('fr-FR'));
  console.log(DRY_RUN ? '🔍 DRY-RUN' : '🚀 PRODUCTION');

  const allData = {};
  for (const [id, cinema] of Object.entries(CINEMAS)) {
    try {
      allData[id] = cinema.chain === 'ugc'
        ? await scrapeUGC(id, cinema)
        : await scrapePathe(id, cinema);
    } catch (e) {
      console.error(`❌ ${id}:`, e.message);
      allData[id] = { films:{}, seances:{} };
    }
    const nf = Object.keys(allData[id].films).length;
    const ns = Object.values(allData[id].seances).reduce((s,d)=>s+Object.values(d).reduce((a,h)=>a+h.length,0),0);
    console.log(`  ${nf>0?'✓':'✗'} ${id}: ${nf} films, ${ns} séances`);
    await sleep(500);
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
