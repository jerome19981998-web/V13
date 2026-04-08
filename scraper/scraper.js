#!/usr/bin/env node
// CinéLynker Scraper v17 — API interne AlloCiné /_/showtimes/ (découverte via interception)
'use strict';

const https = require('https');

const DRY_RUN  = process.env.DRY_RUN === 'true';
const DAYS     = 7;
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const TMDB_TOKEN = process.env.TMDB_TOKEN ||
  'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIzMzY0M2EwMDRiZGMyYzdlNmIyYTFjOWMzZWI5ZDhlYyIsIm5iZiI6MTc3MzAwMTIzNy42ODYsInN1YiI6IjY5YWRkYTE1MmVmNWMxZmY5NWZjYmNlOCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.bRW2UVqu1p89xPusKV5-mzW4ZeRSk8ij811FWOIwoBM';

const CINEMAS = {
  'ugc-halles':           { name:'UGC Ciné Cité Les Halles',   chain:'ugc',    acId:'C0159', lat:48.8603, lng:2.3477, addr:'7 pl. de la Rotonde, 75001',    metro:'Les Halles' },
  'ugc-bercy':            { name:'UGC Ciné Cité Bercy',        chain:'ugc',    acId:'C2954', lat:48.8392, lng:2.3796, addr:'2 cour Saint-Émilion, 75012',   metro:'Cour Saint-Émilion' },
  'ugc-maillot':          { name:'UGC Maillot',                chain:'ugc',    acId:'C0076', lat:48.8790, lng:2.2835, addr:'74 av de la Grande Armée, 75017',metro:'Argentine' },
  'ugc-opera':            { name:'UGC Opéra',                  chain:'ugc',    acId:'C0089', lat:48.8703, lng:2.3340, addr:'32 bd des Italiens, 75009',     metro:'Opéra' },
  'pathe-parnasse':       { name:'Pathé Parnasse Premium',     chain:'pathe',  acId:'C0158', lat:48.8527, lng:2.3403, addr:'99 bd du Montparnasse, 75006',  metro:'Vavin' },
  'ugc-danton':           { name:'UGC Danton',                  chain:'ugc',    acId:'C0103', lat:48.8527, lng:2.3403, addr:'99 bd du Montparnasse, 75006',  metro:'Vavin' },
  'ugc-montparnasse':     { name:'UGC Montparnasse',           chain:'ugc',    acId:'C0083', lat:48.8418, lng:2.3230, addr:'13 rue du Commandant Mouchotte',metro:'Montparnasse' },
  'ugc-lyon':             { name:'UGC Lyon-Bastille',          chain:'ugc',    acId:'C0161', lat:48.8531, lng:2.3696, addr:'18 rue du Faubourg St-Antoine', metro:'Bastille' },
  'pathe-beaugrenelle':   { name:'Pathé Beaugrenelle',         chain:'pathe',  acId:'C0012', lat:48.8463, lng:2.2885, addr:'12 rue Linois, 75015',          metro:'Charles Michels' },
  'pathe-convention':     { name:'Pathé Convention',           chain:'pathe',  acId:'C0037', lat:48.8382, lng:2.3072, addr:'27 rue Alain-Chartier, 75015',  metro:'Convention' },
  'pathe-bnp':            { name:'Pathé BNP Paribas',          chain:'pathe',  acId:'C0060', lat:48.8841, lng:2.3272, addr:'14 pl. de Clichy, 75018',       metro:'Place de Clichy' },
  'pathe-alesia':         { name:'Pathé Alésia',               chain:'pathe',  acId:'C0116', lat:48.8277, lng:2.3260, addr:'73 av du Gén. Leclerc, 75014',  metro:'Alésia' },
  'pathe-montparnos':   { name:'Pathé Montparnos',         chain:'pathe',  acId:'C0052', lat:48.8416, lng:2.3263, addr:"16 rue d'Odessa, 75014",           metro:'Montparnasse' },
  'pathe-fauvettes':    { name:'Pathé Les Fauvettes',      chain:'pathe',  acId:'C0024', lat:48.8357, lng:2.3519, addr:'58 av des Gobelins, 75013',          metro:'Gobelins' },
  'la-geode':           { name:'La Géode IMAX',            chain:'pathe',  acId:'C0189', lat:48.8942, lng:2.3882, addr:'26 av Corentin Cariou, 75019',       metro:'Porte de la Villette' },
  'pathe-la-villette':  { name:'Pathé La Villette IMAX',  chain:'pathe',  acId:'W7520', lat:48.8948, lng:2.3876, addr:'30 av Corentin Cariou, 75019',       metro:'Porte de la Villette' },
  'pathe-palace':       { name:'Pathé Palace',             chain:'pathe',  acId:'G02BG', lat:48.8706, lng:2.3314, addr:'2 bd des Capucines, 75009',          metro:'Opéra' },
  'pathe-batignolles':  { name:'Les 7 Batignolles',        chain:'pathe',  acId:'P7517', lat:48.8856, lng:2.3240, addr:'86 rue M. Rostropovitch, 75017',    metro:'Brochant' },
  'pathe-levallois':    { name:'Pathé Levallois',          chain:'pathe',  acId:'W9230', lat:48.8930, lng:2.2870, addr:'9 rue Jules Oudin, 92300',           metro:'Anatole France' },
  'pathe-quai-ivry':   { name:"Pathé Quai d'Ivry IMAX",  chain:'pathe',  acId:'B0258', lat:48.8149, lng:2.3860, addr:'1 rue du Castel, 94200',              metro:'Ivry' },
  'pathe-saint-denis':  { name:'Pathé Saint-Denis',        chain:'pathe',  acId:'B0242', lat:48.9296, lng:2.3602, addr:'2 pl du 8 Mai 1945, 93210',          metro:'Saint-Denis' },
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
function getDateISO(o=0){ const d=new Date(); d.setDate(d.getDate()+o); return d.toISOString().slice(0,10); }
function slugify(t){ return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
function toHeure(s){
  if(!s) return null; s=String(s).trim();
  const m3=s.match(/T(\d{2}):(\d{2})/); if(m3) return `${parseInt(m3[1])}h${m3[2]}`;
  const m1=s.match(/(\d{1,2})[h:H](\d{2})/); if(m1) return `${parseInt(m1[1])}h${m1[2]}`;
  return null;
}

// ─── HTTP ─────────────────────────────────────────────────────────────────────
function fetchJSON(url, headers={}) {
  return new Promise(resolve => {
    const opts = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Referer': 'https://www.allocine.fr/',
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://www.allocine.fr',
        ...headers,
      },
      timeout: 15000,
    };
    const req = https.get(url, opts, res => {
      if([301,302,307,308].includes(res.statusCode) && res.headers.location) {
        const loc = res.headers.location.startsWith('http') ? res.headers.location : `https://www.allocine.fr${res.headers.location}`;
        return fetchJSON(loc, headers).then(resolve);
      }
      let body = ''; res.setEncoding('utf8');
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body), raw: body }); }
        catch(e) { resolve({ status: res.statusCode, data: null, raw: body.slice(0, 200) }); }
      });
    });
    req.on('error', e => resolve({ status: 0, data: null, err: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, data: null, err: 'timeout' }); });
  });
}

// ─── PARSER du format /_/showtimes/ ─────────────────────────────────────────
// Format réel: {"error":false,"results":[{"movie":{...},"showtimes":[{"startsAt":"2026-03-17T14:30:00",...},...]},...]}
function parseAllocineInternal(data) {
  if (!data || data.error || !Array.isArray(data.results)) return [];
  const results = [];

  for (const item of data.results) {
    const movie = item.movie || {};
    const title = movie.title || movie.originalTitle || '';
    if (!title) continue;

    const runtime = movie.runtime || 0;
    const duration = runtime ? `${Math.floor(runtime/60)}h${String(runtime%60).padStart(2,'0')}` : '';
    const genreRaw = movie.genres?.[0]?.tag || movie.genres?.[0] || '';
    const genre = genreRaw.toLowerCase();
    const synopsis = movie.synopsis || movie.synopsisShort || '';
    const director = (movie.credits || []).find(c =>
      ['Director','DIRECTOR','Réalisateur'].includes(c.role || c.function || c.position)
    )?.person?.fullName || '';
    const poster = movie.poster?.url || movie.poster?.href || null;
    const tmdbNote = movie.stats?.userRating?.score || null;

    // Showtimes: tableau direct ou groupé par version
    let allShowtimes = [];
    if (Array.isArray(item.showtimes)) {
      allShowtimes = item.showtimes;
    } else if (Array.isArray(item.screenings)) {
      allShowtimes = item.screenings;
    } else if (Array.isArray(item.shows)) {
      allShowtimes = item.shows;
    } else if (item.showtimes && typeof item.showtimes === 'object') {
      // Parfois groupé: { "vf": [...], "vost": [...] }
      allShowtimes = Object.values(item.showtimes).flat();
    }

    const heures = allShowtimes
      .map(s => {
        if (typeof s === 'string') return toHeure(s);
        return toHeure(s.startsAt || s.time || s.heure || s.startTime || s.datetime || '');
      })
      .filter(Boolean);

    if (title && heures.length) {
      results.push({ title, director, duration, genre, synopsis, poster, tmdbNote, heures });
    }
  }
  return results;
}

// ─── FETCH SÉANCES POUR 1 CINÉMA × 1 DATE ────────────────────────────────────
async function fetchShowtimes(acId, dateISO) {
  const baseUrl = `https://www.allocine.fr/_/showtimes/theater-${acId}/d-${dateISO}/`;
  let allSeances = [];
  let page = 1;
  const MAX_PAGES = 5; // max 5 pages = 75 films par cinema par jour

  while(page <= MAX_PAGES) {
    // Try both URL formats for pagination
    const url = page === 1 ? baseUrl : `https://www.allocine.fr/_/showtimes/theater-${acId}/d-${dateISO}/p-${page}/`;
    const { status, data, raw } = await fetchJSON(url);

    if (status !== 200 || !data) {
      if (page === 1) {
        console.log(`    ⚠ HTTP ${status} pour ${url.slice(0, 60)}`);
        if (raw) console.log(`    raw: ${raw.slice(0, 100)}`);
        return { seances: [], source: 'error' };
      }
      break; // no more pages
    }

    if (!data.results?.length) {
      if (page === 1) {
        // debug only on first page
        console.log(`    [debug] results count: 0, first keys: []`);
      }
      break;
    }

    const parsed = parseAllocineInternal(data);
    const newFilms = parsed.filter(p => !allSeances.some(a => a.title === p.title));
    allSeances = [...allSeances, ...parsed];
    
    if (page > 1) console.log(`    📄 page ${page}: ${data.results.length} résultats, ${newFilms.length} nouveaux films`);

    // Check pagination info from API response
    const totalResults = data.totalResults || data.total || null;
    if (totalResults) console.log(`    📊 Total API: ${totalResults} films`);

    // If less than 15 results → last page
    if (data.results.length < 15) break;
    
    // If no new films on this page → stop (avoid infinite loops)
    if (page > 1 && newFilms.length === 0) break;

    page++;
    if (page <= MAX_PAGES) await sleep(400); // polite delay between pages
  }

  if (allSeances.length > 0) {
    if (page > 2) console.log(`    📄 ${page-1} pages → ${allSeances.length} films total`);
    return { seances: allSeances, source: 'api' };
  }
  return { seances: [], source: 'api_empty' };
}

// ─── SCRAPE 1 CINEMA ─────────────────────────────────────────────────────────
async function scrapeCinema(cinemaId, cinema) {
  console.log(`\n📍 ${cinemaId} (${cinema.acId})`);
  const result = { films:{}, seances:{} };

  for (let day = 0; day < DAYS; day++) {
    const dateISO = getDateISO(day);
    const { seances, source } = await fetchShowtimes(cinema.acId, dateISO);

    console.log(`  ${dateISO}: ${seances.length} films [${source}]`);

    for (const { title, director, duration, genre, synopsis, poster, tmdbNote, heures } of seances) {
      const slug = slugify(title);
      if (!result.films[slug]) result.films[slug] = { slug, title, director, duration, genre, synopsis, poster, tmdbNote };
      if (!result.seances[slug]) result.seances[slug] = {};
      const prev = result.seances[slug][dateISO] || [];
      result.seances[slug][dateISO] = [...new Set([...prev, ...heures])].sort();
    }

    await sleep(400);
  }

  const nF = Object.keys(result.films).length;
  const nS = Object.values(result.seances).reduce((s,fd) => s + Object.values(fd).reduce((a,h) => a+h.length, 0), 0);
  console.log(`  → ${nF} films, ${nS} séances`);
  return result;
}

// ─── TMDB ─────────────────────────────────────────────────────────────────────
async function enrichWithTMDB(films) {
  console.log('\n🎬 Enrichissement TMDB...'); let ok = 0;
  for (const film of Object.values(films)) {
    if (film.tmdbId && film.poster && film.tmdbNote) { ok++; continue; }
    try {
      const { data: d } = await fetchJSON(
        `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(film.title)}&language=fr-FR&region=FR`,
        { Authorization: `Bearer ${TMDB_TOKEN}`, 'X-Requested-With': '' }
      );
      const m = d?.results?.[0]; if (!m) continue;
      if (!film.poster && m.poster_path)      film.poster   = `https://image.tmdb.org/t/p/w500${m.poster_path}`;
      if (!film.tmdbNote && m.vote_average>0) film.tmdbNote = Math.round(m.vote_average*10)/10;
      if (!film.synopsis && m.overview)       film.synopsis = m.overview;
      film.tmdbId = m.id;
      const { data: vd } = await fetchJSON(
        `https://api.themoviedb.org/3/movie/${m.id}/videos?language=fr-FR`,
        { Authorization: `Bearer ${TMDB_TOKEN}`, 'X-Requested-With': '' }
      );
      const t = vd?.results?.find(v => v.type==='Trailer' && v.site==='YouTube') || vd?.results?.find(v => v.site==='YouTube');
      if (t) film.trailerKey = t.key;
      ok++; await sleep(200);
    } catch(e) {}
  }
  console.log(`  ✓ ${ok}/${Object.keys(films).length} enrichis`);
}

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
function supaReq(path, method, body) {
  return new Promise(resolve => {
    const payload = JSON.stringify(body); const isDel = method === 'DELETE';
    const opts = {
      hostname: 'alwfbminhdwinxcozjlj.supabase.co', path: `/rest/v1/${path}`, method,
      headers: { 'Content-Type':'application/json', 'apikey':SUPA_KEY, 'Authorization':`Bearer ${SUPA_KEY}`,
        'Prefer':'resolution=merge-duplicates', ...(!isDel && {'Content-Length':Buffer.byteLength(payload)}) },
    };
    const req = https.request(opts, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({status:res.statusCode,body:d})); });
    req.on('error', e => resolve({status:0,body:e.message}));
    if (!isDel) req.write(payload); req.end();
  });
}

async function pushToSupabase(allData) {
  console.log('\n📤 Push Supabase...');
  const cinRows = Object.entries(CINEMAS).map(([id,c]) => ({id,name:c.name,chain:c.chain,lat:c.lat,lng:c.lng,addr:c.addr,metro:c.metro}));
  const cr = await supaReq('cinemas_dyn','POST',cinRows); console.log(`  cinémas: ${cr.status}`);

  const allFilms = {};
  for (const {films} of Object.values(allData)) {
    for (const [slug,f] of Object.entries(films)) {
      if (!allFilms[slug]) allFilms[slug] = {...f};
      else for (const k of ['director','duration','genre','synopsis','poster','tmdbNote']) if (!allFilms[slug][k] && f[k]) allFilms[slug][k] = f[k];
    }
  }
  await enrichWithTMDB(allFilms);

  const filmRows = Object.values(allFilms).map(f => ({
    id:f.slug, title:f.title, director:f.director||'', duration:f.duration||'', genre:f.genre||'',
    synopsis:f.synopsis||'', poster_url:f.poster||null, tmdb_id:f.tmdbId||null,
    tmdb_note:f.tmdbNote||null, trailer_key:f.trailerKey||null, updated_at:new Date().toISOString(),
  }));
  const fr = await supaReq('films_dyn','POST',filmRows); console.log(`  films: ${fr.status} (${filmRows.length})`);

  await supaReq(`seances_dyn?date=gte.${getDateISO(0)}`,'DELETE',{});
  const rows = [];
  for (const [cinId,{seances}] of Object.entries(allData))
    for (const [slug,dates] of Object.entries(seances))
      for (const [date,heures] of Object.entries(dates))
        if (heures.length) rows.push({ cinema_id:cinId, film_id:slug, date, heures });

  let ins = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const sr = await supaReq('seances_dyn','POST',rows.slice(i,i+200));
    if (sr.status <= 299) ins += Math.min(200, rows.length-i);
    else console.error(`  ❌ batch ${i}: ${sr.status} — ${sr.body.slice(0,100)}`);
  }
  console.log(`  séances: ${ins}/${rows.length}`);

  // Write health status so the app can detect stale data
  await supaReq('scraper_health', 'POST', [{
    ran_at: new Date().toISOString(),
    success: true,
    films_count: filmRows.length,
    seances_count: rows.length,
    error_msg: null,
  }]);
  console.log('  ✓ Health status enregistré');
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`🎬 CinéLynker Scraper v17 — ${new Date().toLocaleString('fr-FR',{timeZone:'Europe/Paris'})}`);
  console.log(DRY_RUN ? '🔍 DRY-RUN' : '🚀 PRODUCTION'); console.log('─'.repeat(50));

  const allData = {};
  for (const [id, cinema] of Object.entries(CINEMAS)) {
    try { allData[id] = await scrapeCinema(id, cinema); }
    catch(e) { console.error(`❌ ${id}: ${e.message}`); allData[id] = {films:{},seances:{}}; }
    await sleep(500);
  }

  console.log('\n' + '─'.repeat(50));
  let totalFilms = new Set(), totalSeances = 0;
  for (const [cid, data] of Object.entries(allData)) {
    const nf = Object.keys(data.films).length;
    const ns = Object.values(data.seances).reduce((s,fd) => s+Object.values(fd).reduce((a,h) => a+h.length,0),0);
    Object.keys(data.films).forEach(t => totalFilms.add(t)); totalSeances += ns;
    console.log(`  ${nf>0?'✓':'✗'} ${cid}: ${nf} films, ${ns} séances`);
  }
  console.log(`\n📊 TOTAL: ${totalFilms.size} films, ${totalSeances} séances`);

  if (DRY_RUN) {
    const ex = Object.entries(allData).find(([,d]) => Object.keys(d.seances).length > 0);
    if (ex) {
      const [cid, data] = ex; console.log(`\n🔍 Exemple (${cid}):`);
      Object.entries(data.seances).slice(0,3).forEach(([slug,dates]) => {
        console.log(`  "${data.films[slug]?.title||slug}":`);
        Object.entries(dates).forEach(([d,h]) => console.log(`    ${d}: ${h.join(', ')}`));
      });
    }
    return;
  }
  if (!SUPA_KEY) { console.error('❌ SUPABASE_SERVICE_KEY manquante'); process.exit(1); }
  await pushToSupabase(allData);
  console.log('\n✅ Terminé.');
}

main().catch(async e => {
  console.error('❌ Fatal:', e);
  // Report failure to Supabase so app can show warning
  try {
    await supaReq('scraper_health', 'POST', [{
      ran_at: new Date().toISOString(),
      success: false,
      films_count: 0,
      seances_count: 0,
      error_msg: e.message?.slice(0, 500) || String(e),
    }]);
  } catch(_) {}
  process.exit(1);
});
