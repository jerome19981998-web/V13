#!/usr/bin/env node
// CinéMatch Scraper v16 — Puppeteer + interception réseau (capture appels API internes)
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
function getDateISO(o=0){ const d=new Date(); d.setDate(d.getDate()+o); return d.toISOString().slice(0,10); }
function slugify(t){ return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
function toHeure(s){
  if(!s) return null; s=String(s).trim();
  const m3=s.match(/T(\d{2}):(\d{2})/); if(m3) return `${parseInt(m3[1])}h${m3[2]}`;
  const m1=s.match(/(\d{1,2})[h:H](\d{2})/); if(m1) return `${parseInt(m1[1])}h${m1[2]}`;
  return null;
}

let browser = null;
async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--window-size=1280,800','--lang=fr-FR'],
    });
  }
  return browser;
}

// ─── CORE: charger une page et intercepter TOUTES les réponses JSON ────────────
async function fetchPageWithInterception(url) {
  const b = await getBrowser();
  const page = await b.newPage();
  const apiResponses = []; // on capture tout
  
  try {
    await page.setExtraHTTPHeaders({'Accept-Language':'fr-FR,fr;q=0.9'});
    await page.setViewport({width:1280, height:800});

    // Intercepter toutes les réponses réseau
    page.on('response', async response => {
      const resUrl = response.url();
      const ct = response.headers()['content-type'] || '';
      // Capturer uniquement les JSON et les URLs qui ressemblent à des APIs
      if (ct.includes('json') || resUrl.includes('/api/') || resUrl.includes('showtimes') || resUrl.includes('seances')) {
        try {
          const body = await response.text();
          if (body.length > 50 && body.startsWith('{') || body.startsWith('[')) {
            apiResponses.push({ url: resUrl, body, status: response.status() });
          }
        } catch(e) {}
      }
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 35000 });
    await sleep(3000); // attendre appels tardifs

    // Log des APIs capturées (premiers 200 chars)
    const interesting = apiResponses.filter(r => 
      r.url.includes('showtime') || r.url.includes('seance') || r.url.includes('movie') ||
      r.url.includes('film') || r.url.includes('program') || r.url.includes('schedule')
    );
    
    if (interesting.length > 0) {
      console.log(`    📡 ${interesting.length} API(s) capturée(s):`);
      interesting.slice(0, 5).forEach(r => {
        console.log(`      ${r.url.slice(0, 80)} → ${r.status} (${r.body.length} chars)`);
        console.log(`      preview: ${r.body.slice(0, 120)}`);
      });
    } else {
      // Log toutes les réponses JSON pour debug
      console.log(`    📡 ${apiResponses.length} JSON total, URLs:`);
      apiResponses.slice(0, 8).forEach(r => {
        console.log(`      ${r.url.slice(0, 80)} (${r.body.length})`);
      });
    }

    return { apiResponses, interesting };
  } catch(e) {
    console.log(`    ⚠ ${e.message.slice(0, 80)}`);
    return { apiResponses: [], interesting: [] };
  } finally {
    await page.close();
  }
}

// ─── PARSER UNIVERSEL pour données séances JSON ────────────────────────────────
function parseShowtimesJSON(body) {
  const results = [];
  let data;
  try { data = JSON.parse(body); } catch(e) { return results; }

  // Chercher récursivement des tableaux de films/séances
  function extractFromObj(obj, depth=0) {
    if (depth > 6 || !obj || typeof obj !== 'object') return;
    
    // Pattern: objet avec title/titre + showtimes/horaires
    if (typeof obj.title === 'string' && obj.title.length > 1) {
      const title = obj.title || obj.titre || '';
      const runtime = obj.runtime || obj.duration || 0;
      const duration = runtime ? `${Math.floor(runtime/60)}h${String(runtime%60).padStart(2,'0')}` : '';
      const genre = (obj.genres?.[0]?.tag || obj.genres?.[0]?.label || obj.genres?.[0] || obj.genre || '').toLowerCase();
      const synopsis = obj.synopsis || obj.synopsisShort || '';
      const poster = obj.poster?.url || obj.poster?.href || obj.posterUrl || null;
      const tmdbNote = obj.stats?.userRating?.score || null;

      // Chercher les horaires dans les enfants directs
      const timeSources = [
        obj.showtimes, obj.seances, obj.times, obj.screenings, obj.diffusions,
        obj.shows, obj.slots, obj.horaires,
      ].filter(x => Array.isArray(x) && x.length > 0);
      
      for (const ts of timeSources) {
        const heures = ts.map(s => {
          if (typeof s === 'string') return toHeure(s);
          return toHeure(s.startsAt || s.time || s.heure || s.startTime || s.datetime || s.d || '');
        }).filter(Boolean);
        if (title && heures.length) {
          results.push({title, director:'', duration, genre, synopsis, poster, tmdbNote, heures});
          return;
        }
      }
    }
    
    // Descendre dans les tableaux et objets
    if (Array.isArray(obj)) {
      obj.forEach(item => extractFromObj(item, depth+1));
    } else {
      Object.values(obj).forEach(val => {
        if (val && typeof val === 'object') extractFromObj(val, depth+1);
      });
    }
  }
  
  extractFromObj(data);
  return results;
}

// ─── SCRAPE 1 CINEMA ─────────────────────────────────────────────────────────
async function scrapeCinema(cinemaId, cinema) {
  console.log(`\n📍 ${cinemaId}`);
  const result = { films:{}, seances:{} };

  for (let day = 0; day < DAYS; day++) {
    const dateISO = getDateISO(day);
    const base = `https://www.allocine.fr/seance/salle_gen_csalle=${cinema.acId}.html`;
    const url  = day === 0 ? base : `${base}?date=${dateISO}`;

    const { interesting, apiResponses } = await fetchPageWithInterception(url);

    let seances = [];
    // Essayer les APIs capturées (par ordre de pertinence)
    for (const api of [...interesting, ...apiResponses.filter(r => !interesting.includes(r))]) {
      const parsed = parseShowtimesJSON(api.body);
      if (parsed.length > 0) {
        seances = parsed;
        console.log(`    ✓ parsé depuis: ${api.url.slice(0,60)}`);
        break;
      }
    }

    console.log(`  ${dateISO}: ${seances.length} films`);

    for (const {title,director,duration,genre,synopsis,poster,tmdbNote,heures} of seances) {
      const slug = slugify(title);
      if (!result.films[slug]) result.films[slug] = {slug,title,director,duration,genre,synopsis,poster,tmdbNote};
      if (!result.seances[slug]) result.seances[slug] = {};
      const prev = result.seances[slug][dateISO] || [];
      result.seances[slug][dateISO] = [...new Set([...prev,...heures])].sort();
    }

    await sleep(2000);
  }

  const nF = Object.keys(result.films).length;
  const nS = Object.values(result.seances).reduce((s,fd)=>s+Object.values(fd).reduce((a,h)=>a+h.length,0),0);
  console.log(`  → ${nF} films, ${nS} séances`);
  return result;
}

// ─── TMDB ─────────────────────────────────────────────────────────────────────
function httpGet(url, headers={}) {
  return new Promise(resolve => {
    const opts = {headers:{'User-Agent':'node/18','Accept':'application/json',...headers},timeout:12000};
    const req = https.get(url, opts, res => {
      let d=''; res.on('data',c=>d+=c);
      res.on('end',()=>{ try{resolve(JSON.parse(d));}catch{resolve(null);} });
    });
    req.on('error',()=>resolve(null)); req.on('timeout',()=>{ req.destroy(); resolve(null); });
  });
}
async function enrichWithTMDB(films) {
  console.log('\n🎬 Enrichissement TMDB...'); let ok=0;
  for (const film of Object.values(films)) {
    if (film.tmdbId&&film.poster&&film.tmdbNote){ok++;continue;}
    try {
      const d = await httpGet(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(film.title)}&language=fr-FR&region=FR`,{Authorization:`Bearer ${TMDB_TOKEN}`});
      const m = d?.results?.[0]; if(!m) continue;
      if(!film.poster&&m.poster_path)      film.poster  =`https://image.tmdb.org/t/p/w500${m.poster_path}`;
      if(!film.tmdbNote&&m.vote_average>0) film.tmdbNote=Math.round(m.vote_average*10)/10;
      if(!film.synopsis&&m.overview)       film.synopsis=m.overview;
      film.tmdbId=m.id;
      const vd=await httpGet(`https://api.themoviedb.org/3/movie/${m.id}/videos?language=fr-FR`,{Authorization:`Bearer ${TMDB_TOKEN}`});
      const t=vd?.results?.find(v=>v.type==='Trailer'&&v.site==='YouTube')||vd?.results?.find(v=>v.site==='YouTube');
      if(t) film.trailerKey=t.key;
      ok++; await sleep(200);
    } catch(e){}
  }
  console.log(`  ✓ ${ok}/${Object.keys(films).length} enrichis`);
}

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
function supaReq(path,method,body){
  return new Promise(resolve=>{
    const payload=JSON.stringify(body); const isDel=method==='DELETE';
    const opts={hostname:'alwfbminhdwinxcozjlj.supabase.co',path:`/rest/v1/${path}`,method,
      headers:{'Content-Type':'application/json','apikey':SUPA_KEY,'Authorization':`Bearer ${SUPA_KEY}`,
        'Prefer':'resolution=merge-duplicates',...(!isDel&&{'Content-Length':Buffer.byteLength(payload)})}};
    const r=https.request(opts,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>resolve({status:res.statusCode,body:d}));});
    r.on('error',e=>resolve({status:0,body:e.message})); if(!isDel) r.write(payload); r.end();
  });
}
async function pushToSupabase(allData){
  console.log('\n📤 Push Supabase...');
  const cinRows=Object.entries(CINEMAS).map(([id,c])=>({id,name:c.name,chain:c.chain,lat:c.lat,lng:c.lng,addr:c.addr,metro:c.metro}));
  const cr=await supaReq('cinemas_dyn','POST',cinRows); console.log(`  cinémas: ${cr.status}`);
  const allFilms={};
  for(const{films}of Object.values(allData)){for(const[slug,f]of Object.entries(films)){if(!allFilms[slug])allFilms[slug]={...f};else for(const k of['director','duration','genre','synopsis','poster','tmdbNote'])if(!allFilms[slug][k]&&f[k])allFilms[slug][k]=f[k];}}
  await enrichWithTMDB(allFilms);
  const filmRows=Object.values(allFilms).map(f=>({id:f.slug,title:f.title,director:f.director||'',duration:f.duration||'',genre:f.genre||'',synopsis:f.synopsis||'',poster_url:f.poster||null,tmdb_id:f.tmdbId||null,tmdb_note:f.tmdbNote||null,trailer_key:f.trailerKey||null,updated_at:new Date().toISOString()}));
  const fr=await supaReq('films_dyn','POST',filmRows); console.log(`  films: ${fr.status} (${filmRows.length})`);
  await supaReq(`seances_dyn?date=gte.${getDateISO(0)}`,'DELETE',{});
  const rows=[];
  for(const[cinId,{seances}]of Object.entries(allData))for(const[slug,dates]of Object.entries(seances))for(const[date,heures]of Object.entries(dates))if(heures.length)rows.push({cinema_id:cinId,film_id:slug,date,heures});
  let ins=0;
  for(let i=0;i<rows.length;i+=200){const sr=await supaReq('seances_dyn','POST',rows.slice(i,i+200));if(sr.status<=299)ins+=Math.min(200,rows.length-i);else console.error(`  ❌ batch ${i}: ${sr.status}`);}
  console.log(`  séances: ${ins}/${rows.length}`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main(){
  console.log(`🎬 CinéMatch Scraper v16 — ${new Date().toLocaleString('fr-FR',{timeZone:'Europe/Paris'})}`);
  console.log(DRY_RUN?'🔍 DRY-RUN':'🚀 PRODUCTION'); console.log('─'.repeat(50));

  // En dry-run: 1 seul cinéma, 1 seul jour pour voir les APIs capturées
  const toTest = DRY_RUN
    ? { 'ugc-halles':CINEMAS['ugc-halles'], 'pathe-alesia':CINEMAS['pathe-alesia'], 'gaumont-opera':CINEMAS['gaumont-opera'] }
    : CINEMAS;
  // En dry-run, seulement aujourd'hui pour aller vite
  const origDays = DAYS;
  if (DRY_RUN) global.DAYS_OVERRIDE = 1;

  const allData={};
  try {
    for(const[id,cinema]of Object.entries(toTest)){
      try{ allData[id]=await scrapeCinema(id,cinema); }
      catch(e){ console.error(`❌ ${id}: ${e.message}`); allData[id]={films:{},seances:{}}; }
      await sleep(1000);
    }
  } finally {
    if(browser) await browser.close();
  }

  console.log('\n'+'─'.repeat(50));
  let tf=new Set(),ts=0;
  for(const[cid,data]of Object.entries(allData)){
    const nf=Object.keys(data.films).length; const ns=Object.values(data.seances).reduce((s,fd)=>s+Object.values(fd).reduce((a,h)=>a+h.length,0),0);
    Object.keys(data.films).forEach(t=>tf.add(t)); ts+=ns;
    console.log(`  ${nf>0?'✓':'✗'} ${cid}: ${nf} films, ${ns} séances`);
  }
  console.log(`\n📊 TOTAL: ${tf.size} films, ${ts} séances`);

  if(DRY_RUN){
    const ex=Object.entries(allData).find(([,d])=>Object.keys(d.seances).length>0);
    if(ex){const[cid,data]=ex;console.log(`\n🔍 Exemple (${cid}):`);Object.entries(data.seances).slice(0,3).forEach(([slug,dates])=>{console.log(`  "${data.films[slug]?.title||slug}":`);Object.entries(dates).forEach(([d,h])=>console.log(`    ${d}: ${h.join(', ')}`));});}
    return;
  }
  if(!SUPA_KEY){console.error('❌ SUPABASE_SERVICE_KEY manquante');process.exit(1);}
  await pushToSupabase(allData);
  console.log('\n✅ Terminé.');
}

main().catch(e=>{ console.error('❌ Fatal:',e); if(browser) browser.close(); process.exit(1); });
