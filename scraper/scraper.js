#!/usr/bin/env node
// CinéMatch Scraper v15 — Puppeteer stealth (contourne Cloudflare)
'use strict';

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const https = require('https');

const DRY_RUN  = process.env.DRY_RUN === 'true';
const DAYS     = 7;
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const TMDB_TOKEN = process.env.TMDB_TOKEN ||
  'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIzMzY0M2EwMDRiZGMyYzdlNmIyYTFjOWMzZWI5ZDhlYyIsIm5iZiI6MTc3MzAwMTIzNy42ODYsInN1YiI6IjY5YWRkYTE1MmVmNWMxZmY5NWZjYmNlOCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.bRW2UVqu1p89xPusKV5-mzW4ZeRSk8ij811FWOIwoBM';

const CINEMAS = {
  'ugc-halles':           { name:'UGC Ciné Cité Les Halles',   chain:'ugc',    acId:'C0159', lat:48.8603, lng:2.3477, addr:'7 pl. de la Rotonde, 75001',    metro:'Les Halles' },
  'ugc-bercy':            { name:'UGC Ciné Cité Bercy',        chain:'ugc',    acId:'C0157', lat:48.8392, lng:2.3796, addr:'2 cour Saint-Émilion, 75012',   metro:'Cour Saint-Émilion' },
  'ugc-paris19':          { name:'UGC Ciné Cité Paris 19',     chain:'ugc',    acId:'C0173', lat:48.8848, lng:2.3834, addr:'1 rue du Cinéma, 75019',        metro:'Corentin Cariou' },
  'ugc-maillot':          { name:'UGC Maillot',                chain:'ugc',    acId:'C0162', lat:48.8790, lng:2.2835, addr:'74 av de la Grande Armée, 75017',metro:'Argentine' },
  'ugc-opera':            { name:'UGC Opéra',                  chain:'ugc',    acId:'C0164', lat:48.8703, lng:2.3340, addr:'32 bd des Italiens, 75009',     metro:'Opéra' },
  'ugc-danton':           { name:'UGC Danton',                 chain:'ugc',    acId:'C0158', lat:48.8527, lng:2.3403, addr:'99 bd du Montparnasse, 75006',  metro:'Vavin' },
  'ugc-montparnasse':     { name:'UGC Montparnasse',           chain:'ugc',    acId:'C0163', lat:48.8418, lng:2.3230, addr:'13 rue du Commandant Mouchotte',metro:'Montparnasse' },
  'ugc-lyon':             { name:'UGC Lyon-Bastille',          chain:'ugc',    acId:'C0161', lat:48.8531, lng:2.3696, addr:'18 rue du Faubourg St-Antoine', metro:'Bastille' },
  'pathe-beaugrenelle':   { name:'Pathé Beaugrenelle',         chain:'pathe',  acId:'C0012', lat:48.8463, lng:2.2885, addr:'12 rue Linois, 75015',          metro:'Charles Michels' },
  'pathe-convention':     { name:'Pathé Convention',           chain:'pathe',  acId:'C0037', lat:48.8382, lng:2.3072, addr:'27 rue Alain-Chartier, 75015',  metro:'Convention' },
  'pathe-parnasse':       { name:'Pathé Parnasse',             chain:'pathe',  acId:'C0122', lat:48.8427, lng:2.3271, addr:'11 rue du Départ, 75014',       metro:'Montparnasse' },
  'pathe-wepler':         { name:'Pathé Wepler',               chain:'pathe',  acId:'C0060', lat:48.8841, lng:2.3272, addr:'14 pl. de Clichy, 75018',       metro:'Place de Clichy' },
  'pathe-alesia':         { name:'Pathé Alésia',               chain:'pathe',  acId:'C0116', lat:48.8277, lng:2.3260, addr:'73 av du Gén. Leclerc, 75014',  metro:'Alésia' },
  'pathe-batignolles':    { name:'Les 7 Batignolles',          chain:'pathe',  acId:'C0059', lat:48.8856, lng:2.3175, addr:'3 rue des Moines, 75017',        metro:'Brochant' },
  'gaumont-opera':        { name:'Gaumont Opéra',              chain:'gaumont',acId:'C0026', lat:48.8716, lng:2.3329, addr:'31 bd des Italiens, 75002',      metro:'Opéra' },
  'gaumont-convention':   { name:'Gaumont Convention',         chain:'gaumont',acId:'C0038', lat:48.8384, lng:2.3060, addr:'25 rue Alain-Chartier, 75015',  metro:'Convention' },
  'gaumont-aquaboulevard':{ name:'Gaumont Aquaboulevard',      chain:'gaumont',acId:'C0015', lat:48.8322, lng:2.2760, addr:'17 rue Linois, 75015',           metro:'Balard' },
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
function getDateISO(offset=0){ const d=new Date(); d.setDate(d.getDate()+offset); return d.toISOString().slice(0,10); }
function slugify(t){ return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
function toHeure(s){
  if(!s) return null; s=String(s).trim();
  const m3=s.match(/T(\d{2}):(\d{2})/); if(m3) return `${parseInt(m3[1])}h${m3[2]}`;
  const m1=s.match(/(\d{1,2})[h:H](\d{2})/); if(m1) return `${parseInt(m1[1])}h${m1[2]}`;
  return null;
}

// ─── PUPPETEER BROWSER (shared) ───────────────────────────────────────────────
let browser = null;
async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1280,800',
        '--lang=fr-FR',
      ],
    });
  }
  return browser;
}

// ─── FETCH PAGE WITH PUPPETEER ────────────────────────────────────────────────
async function fetchPage(url, waitFor = 3000) {
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'fr-FR,fr;q=0.9' });
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(waitFor); // wait for JS to hydrate

    // Extract __NEXT_DATA__
    const nextData = await page.evaluate(() => {
      const el = document.getElementById('__NEXT_DATA__');
      return el ? el.textContent : null;
    });

    // Also get full HTML for fallback
    const html = await page.content();
    return { nextData, html, url };
  } catch(e) {
    console.log(`    ⚠ Puppeteer error: ${e.message.slice(0,80)}`);
    return { nextData: null, html: '', url };
  } finally {
    await page.close();
  }
}

// ─── PARSE NEXT_DATA ──────────────────────────────────────────────────────────
function parseNextData(nextDataStr) {
  if (!nextDataStr) return [];
  try {
    const nd = JSON.parse(nextDataStr);
    const pp = nd?.props?.pageProps || {};

    const candidates = [
      pp.showtimes,
      pp.showTimesPage?.showtimes,
      pp.data?.showtimes,
      pp.theaterShowtimes,
      pp.movieShowtimes,
      pp.initialData?.showtimes,
      pp.pageData?.showtimes,
    ].filter(x => Array.isArray(x) && x.length > 0);

    const results = [];
    for (const list of candidates) {
      for (const st of list) {
        const movie = st.movie || st.film || {};
        const title = movie.title || movie.titre || '';
        if (!title) continue;
        const runtime = movie.runtime || 0;
        const duration = runtime ? `${Math.floor(runtime/60)}h${String(runtime%60).padStart(2,'0')}` : '';
        const genre = (movie.genres?.[0]?.tag || movie.genres?.[0] || '').toLowerCase();
        const synopsis = movie.synopsis || movie.synopsisShort || '';
        const director = (movie.credits||[]).find(c=>['Director','DIRECTOR','Réalisateur'].includes(c.role||c.function))?.person?.fullName || '';
        const poster = movie.poster?.url || null;
        const tmdbNote = movie.stats?.userRating?.score || null;
        const allSt = st.showtimes || st.seances || st.diffusions || [];
        const heures = allSt.map(s => toHeure(s.startsAt||s.time||s.heure||'')).filter(Boolean);
        if (title && heures.length) results.push({title,director,duration,genre,synopsis,poster,tmdbNote,heures});
      }
      if (results.length) return results;
    }

    // Debug: show pageProps keys
    if (results.length === 0) {
      console.log(`    [debug] pageProps keys: ${Object.keys(pp).slice(0,10).join(', ')}`);
    }
    return results;
  } catch(e) {
    console.log(`    [parse error] ${e.message}`);
    return [];
  }
}

// ─── PARSE HTML FALLBACK ──────────────────────────────────────────────────────
function parseHTMLFallback(html) {
  const results = [];
  const timeRe = /(\d{1,2}h\d{2})/g;
  // Look for movie blocks
  const blocks = html.split(/class="[^"]*entity-card[^"]*"/);
  for (const block of blocks.slice(1)) {
    const tM = block.match(/class="[^"]*meta-title[^"]*"[^>]*>(?:<[^>]+>)*([^<]{2,80})/);
    if (!tM) continue;
    const title = tM[1].trim().replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"');
    if (!title || title.length < 2) continue;
    const heures = [...new Set([...block.matchAll(timeRe)].map(m=>m[1]))].sort();
    if (heures.length) results.push({title,director:'',duration:'',genre:'',synopsis:'',poster:null,tmdbNote:null,heures});
  }
  return results;
}

// ─── SCRAPE 1 CINEMA × TOUS LES JOURS ─────────────────────────────────────────
async function scrapeCinema(cinemaId, cinema) {
  console.log(`\n📍 ${cinemaId}`);
  const result = { films:{}, seances:{} };

  for (let day = 0; day < DAYS; day++) {
    const dateISO = getDateISO(day);
    const base = `https://www.allocine.fr/seance/salle_gen_csalle=${cinema.acId}.html`;
    const url  = day === 0 ? base : `${base}?date=${dateISO}`;

    const { nextData, html } = await fetchPage(url, 2500);

    let seances = parseNextData(nextData);
    if (!seances.length && html.length > 5000) seances = parseHTMLFallback(html);

    console.log(`  ${dateISO}: ${seances.length} films${seances.length===0?' (nextData:'+(nextData?nextData.length:0)+' html:'+html.length+')':''}`);

    for (const {title,director,duration,genre,synopsis,poster,tmdbNote,heures} of seances) {
      const slug = slugify(title);
      if (!result.films[slug]) result.films[slug] = {slug,title,director,duration,genre,synopsis,poster,tmdbNote};
      if (!result.seances[slug]) result.seances[slug] = {};
      const prev = result.seances[slug][dateISO] || [];
      result.seances[slug][dateISO] = [...new Set([...prev,...heures])].sort();
    }

    await sleep(1500); // respectful delay between pages
  }

  const nF = Object.keys(result.films).length;
  const nS = Object.values(result.seances).reduce((s,fd)=>s+Object.values(fd).reduce((a,h)=>a+h.length,0),0);
  console.log(`  → ${nF} films, ${nS} séances`);
  return result;
}

// ─── TMDB ENRICHISSEMENT ─────────────────────────────────────────────────────
function httpGet(url, headers={}) {
  return new Promise(resolve => {
    const opts = { headers:{'User-Agent':'node/18','Accept':'application/json',...headers}, timeout:12000 };
    const req = https.get(url, opts, res => {
      let d=''; res.on('data',c=>d+=c);
      res.on('end',()=>{ try{resolve(JSON.parse(d));}catch{resolve(null);} });
    });
    req.on('error',()=>resolve(null));
    req.on('timeout',()=>{ req.destroy(); resolve(null); });
  });
}

async function enrichWithTMDB(films) {
  console.log('\n🎬 Enrichissement TMDB...');
  let ok = 0;
  for (const film of Object.values(films)) {
    if (film.tmdbId && film.poster && film.tmdbNote) { ok++; continue; }
    try {
      const d = await httpGet(
        `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(film.title)}&language=fr-FR&region=FR`,
        {Authorization:`Bearer ${TMDB_TOKEN}`}
      );
      const m = d?.results?.[0];
      if (!m) continue;
      if (!film.poster && m.poster_path)      film.poster   = `https://image.tmdb.org/t/p/w500${m.poster_path}`;
      if (!film.tmdbNote && m.vote_average>0) film.tmdbNote = Math.round(m.vote_average*10)/10;
      if (!film.synopsis && m.overview)       film.synopsis = m.overview;
      film.tmdbId = m.id;
      const vd = await httpGet(`https://api.themoviedb.org/3/movie/${m.id}/videos?language=fr-FR`,{Authorization:`Bearer ${TMDB_TOKEN}`});
      const t = vd?.results?.find(v=>v.type==='Trailer'&&v.site==='YouTube') || vd?.results?.find(v=>v.site==='YouTube');
      if (t) film.trailerKey = t.key;
      ok++; await sleep(200);
    } catch(e) {}
  }
  console.log(`  ✓ ${ok}/${Object.keys(films).length} enrichis`);
}

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
function supaReq(path, method, body) {
  return new Promise(resolve => {
    const payload = JSON.stringify(body);
    const isDel = method === 'DELETE';
    const opts = {
      hostname:'alwfbminhdwinxcozjlj.supabase.co', path:`/rest/v1/${path}`, method,
      headers:{'Content-Type':'application/json','apikey':SUPA_KEY,'Authorization':`Bearer ${SUPA_KEY}`,
        'Prefer':'resolution=merge-duplicates',...(!isDel&&{'Content-Length':Buffer.byteLength(payload)})},
    };
    const req = https.request(opts, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({status:res.statusCode,body:d})); });
    req.on('error',e=>resolve({status:0,body:e.message}));
    if (!isDel) req.write(payload);
    req.end();
  });
}

async function pushToSupabase(allData) {
  console.log('\n📤 Push Supabase...');
  const cinRows = Object.entries(CINEMAS).map(([id,c])=>({id,name:c.name,chain:c.chain,lat:c.lat,lng:c.lng,addr:c.addr,metro:c.metro}));
  const cr = await supaReq('cinemas_dyn','POST',cinRows); console.log(`  cinémas: ${cr.status}`);

  const allFilms = {};
  for (const {films} of Object.values(allData)) {
    for (const [slug,f] of Object.entries(films)) {
      if (!allFilms[slug]) allFilms[slug] = {...f};
      else for (const k of ['director','duration','genre','synopsis','poster','tmdbNote']) if (!allFilms[slug][k]&&f[k]) allFilms[slug][k]=f[k];
    }
  }
  await enrichWithTMDB(allFilms);

  const filmRows = Object.values(allFilms).map(f=>({
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
        if (heures.length) rows.push({cinema_id:cinId,film_id:slug,date,heures});

  let ins=0;
  for (let i=0;i<rows.length;i+=200) {
    const sr = await supaReq('seances_dyn','POST',rows.slice(i,i+200));
    if (sr.status<=299) ins+=Math.min(200,rows.length-i);
    else console.error(`  ❌ batch ${i}: ${sr.status}`);
  }
  console.log(`  séances: ${ins}/${rows.length}`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`🎬 CinéMatch Scraper v15 — ${new Date().toLocaleString('fr-FR',{timeZone:'Europe/Paris'})}`);
  console.log(DRY_RUN?'🔍 DRY-RUN':'🚀 PRODUCTION'); console.log('─'.repeat(50));

  const allData = {};
  try {
    for (const [id, cinema] of Object.entries(CINEMAS)) {
      try { allData[id] = await scrapeCinema(id, cinema); }
      catch(e) { console.error(`❌ ${id}: ${e.message}`); allData[id] = {films:{},seances:{}}; }
      await sleep(800);
    }
  } finally {
    if (browser) await browser.close();
  }

  console.log('\n'+'─'.repeat(50));
  let totalFilms=new Set(), totalSeances=0;
  for (const [cid,data] of Object.entries(allData)) {
    const nf=Object.keys(data.films).length;
    const ns=Object.values(data.seances).reduce((s,fd)=>s+Object.values(fd).reduce((a,h)=>a+h.length,0),0);
    Object.keys(data.films).forEach(t=>totalFilms.add(t)); totalSeances+=ns;
    console.log(`  ${nf>0?'✓':'✗'} ${cid}: ${nf} films, ${ns} séances`);
  }
  console.log(`\n📊 TOTAL: ${totalFilms.size} films, ${totalSeances} séances`);

  if (DRY_RUN) {
    const ex = Object.entries(allData).find(([,d])=>Object.keys(d.seances).length>0);
    if (ex) {
      const [cid,data] = ex; console.log(`\n🔍 Exemple (${cid}):`);
      Object.entries(data.seances).slice(0,3).forEach(([slug,dates])=>{
        console.log(`  "${data.films[slug]?.title||slug}":`);
        Object.entries(dates).forEach(([d,h])=>console.log(`    ${d}: ${h.join(', ')}`));
      });
    }
    return;
  }
  if (!SUPA_KEY) { console.error('❌ SUPABASE_SERVICE_KEY manquante'); process.exit(1); }
  await pushToSupabase(allData);
  console.log('\n✅ Terminé.');
}

main().catch(e => { console.error('❌ Fatal:', e); if(browser) browser.close(); process.exit(1); });
