/**
 * CinéMatch — Scraper v4
 * 
 * Source: allocine.fr page HTML du jour J (serveur-side rendu)
 * Les pages du jour J sont rendues côté serveur → Cheerio suffit.
 * Pour J+1 et J+2, on essaie l'URL /date-YYYY-MM-DD/
 * 
 * IDs AlloCiné format C/W (nouveaux IDs 2024+)
 */

const fetch  = require('node-fetch');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');
const DAYS    = 7;

const SUPA_URL    = process.env.SUPABASE_URL    || 'https://alwfbminhdwinxcozjlj.supabase.co';
const SUPA_KEY    = process.env.SUPABASE_SERVICE_KEY;
const TMDB_TOKEN  = process.env.TMDB_TOKEN || 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIzMzY0M2EwMDRiZGMyYzdlNmIyYTFjOWMzZWI5ZDhlYyIsIm5iZiI6MTc3MzAwMTIzNy42ODYsInN1YiI6IjY5YWRkYTE1MmVmNWMxZmY5NWZjYmNlOCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.bRW2UVqu1p89xPusKV5-mzW4ZeRSk8ij811FWOIwoBM';
const supa        = !DRY_RUN && SUPA_KEY ? createClient(SUPA_URL, SUPA_KEY) : null;

// ─── MAPPING CINÉMAS ─────────────────────────────────────────────────────────
// allocineId = nouvel ID AlloCiné (format C/W, visible dans les URLs allocine.fr)
const CINEMAS = {
  'ugc-halles':            { name: 'UGC Ciné Cité Les Halles',    chain: 'ugc',     lat: 48.8609, lng: 2.3474, addr: '7 pl. de la Rotonde',       metro: 'Les Halles',      allocineId: 'C0159' },
  'ugc-bercy':             { name: 'UGC Ciné Cité Bercy',          chain: 'ugc',     lat: 48.8302, lng: 2.3789, addr: '2 cour Saint-Émilion',      metro: 'Cour St-Émilion', allocineId: 'C0026' },
  'ugc-paris19':           { name: 'UGC Ciné Cité Paris 19',       chain: 'ugc',     lat: 48.8866, lng: 2.3780, addr: '166 bd Macdonald',          metro: 'Corentin Cariou', allocineId: 'W7509' },
  'ugc-maillot':           { name: 'UGC Maillot',                  chain: 'ugc',     lat: 48.8794, lng: 2.2830, addr: '2 pl. Porte Maillot',       metro: 'Porte Maillot',   allocineId: 'C0089' },
  'ugc-opera':             { name: 'UGC Opéra',                    chain: 'ugc',     lat: 48.8719, lng: 2.3387, addr: '34 bd des Italiens',        metro: 'Opéra',           allocineId: 'C0074' },
  'ugc-danton':            { name: 'UGC Danton',                   chain: 'ugc',     lat: 48.8527, lng: 2.3411, addr: '99 bd du Montparnasse',     metro: 'Vavin',           allocineId: 'C0072' },
  'ugc-montparnasse':      { name: 'UGC Montparnasse',              chain: 'ugc',     lat: 48.8424, lng: 2.3244, addr: '83 bd du Montparnasse',     metro: 'Vavin',           allocineId: 'C0103' },
  'ugc-lyon':              { name: 'UGC Lyon-Bastille',             chain: 'ugc',     lat: 48.8448, lng: 2.3731, addr: '12 rue de Lyon',            metro: 'Gare de Lyon',    allocineId: 'C0146' },
  'pathe-beaugrenelle':    { name: 'Pathé Beaugrenelle',            chain: 'pathe',   lat: 48.8473, lng: 2.2894, addr: '7 rue Linois',              metro: 'Charles Michels', allocineId: 'W7502' },
  'pathe-convention':      { name: 'Pathé Convention',              chain: 'pathe',   lat: 48.8396, lng: 2.3087, addr: '27 rue Alain-Chartier',     metro: 'Convention',      allocineId: 'C0161' },
  'pathe-parnasse':        { name: 'Pathé Parnasse',                chain: 'pathe',   lat: 48.8429, lng: 2.3334, addr: '3 rue d\'Odessa',           metro: 'Montparnasse',    allocineId: 'C0158' },
  'pathe-wepler':          { name: 'Pathé Wepler',                  chain: 'pathe',   lat: 48.8842, lng: 2.3272, addr: '140 bd de Clichy',          metro: 'Place de Clichy', allocineId: 'C0179' },
  'pathe-alesia':          { name: 'Pathé Alésia',                  chain: 'pathe',   lat: 48.8272, lng: 2.3264, addr: '73 av. du Gal Leclerc',     metro: 'Alésia',          allocineId: 'C0037' },
  'pathe-batignolles':     { name: 'Les 7 Batignolles',             chain: 'pathe',   lat: 48.8996, lng: 2.3133, addr: '25 allée Colette Heilbronner', metro: 'Porte de Clichy', allocineId: 'P7517' },
  'gaumont-opera':         { name: 'Gaumont Opéra (Capucines)',     chain: 'gaumont', lat: 48.8701, lng: 2.3308, addr: '2 bd des Capucines',        metro: 'Opéra',           allocineId: 'C0125' },
  'gaumont-convention':    { name: 'Gaumont Convention',            chain: 'gaumont', lat: 48.8392, lng: 2.3089, addr: '27 rue Alain-Chartier',     metro: 'Convention',      allocineId: 'C0172' },
  'gaumont-aquaboulevard': { name: 'Gaumont Aquaboulevard',         chain: 'gaumont', lat: 48.8314, lng: 2.2783, addr: '8 rue Colonel Pierre Avia', metro: 'Balard',          allocineId: 'C0116' },
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

function toHeure(str) {
  if (!str) return null;
  const m = String(str).match(/(\d{1,2})[h:Th](\d{2})/i);
  if (!m) return null;
  return `${m[1]}h${m[2]}`;
}

function getDateISO(n = 0) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ─── FETCH HTML ───────────────────────────────────────────────────────────────
async function fetchPage(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'fr-FR,fr;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
        },
        timeout: 15000,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      console.log(`    ⚠ Tentative ${i+1}/${retries}: ${e.message}`);
      if (i < retries - 1) await sleep(2000);
    }
  }
  return null;
}

// ─── PARSE HTML ALLOCINE ──────────────────────────────────────────────────────
function parseAllocineHTML(html, dateISO) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const results = [];

  // Sélecteur principal AlloCiné 2024+ : chaque film = un article
  // L'ID de chaque cinéma crée une structure: article.card > .meta-title > .meta-title-link
  // Les horaires: .showtimes-list .showtimes-version-runtime time ou button
  
  // Essayons plusieurs sélecteurs possibles
  const filmCards = $('article.card, .card.entity-card, [class*="MovieShowtimes"], .item');
  
  filmCards.each((_, card) => {
    const $c = $(card);
    
    // Titre
    let title = $c.find('.meta-title a, .meta-title-link, h2 a, h3 a').first().text().trim();
    if (!title) title = $c.find('a[href*="/film/"]').first().text().trim();
    if (!title || title.length > 120) return;

    // Durée / réalisateur / genre
    const director = $c.find('[class*="director"], .meta-director').first().text().trim().replace(/^de\s+/i, '');
    const duration = $c.find('[class*="duration"], [class*="runtime"], .meta-body-item').filter((_, el) => {
      return /\dh/.test($(el).text());
    }).first().text().trim();
    const genre = $c.find('.meta-body-item[class*="genre"], [class*="genre"]').first().text().trim();

    // Horaires — plusieurs formats possibles
    const heures = [];
    
    // Format 1: <time> tags
    $c.find('time[datetime]').each((_, el) => {
      const dt = $(el).attr('datetime') || $(el).text();
      const h = toHeure(dt);
      if (h && !heures.includes(h)) heures.push(h);
    });
    
    // Format 2: boutons avec texte heure
    if (!heures.length) {
      $c.find('button, span[class*="hour"], [class*="Showtime"]').each((_, el) => {
        const txt = $(el).text().trim();
        const h = toHeure(txt);
        if (h && /^\d{1,2}h\d{2}$/.test(h) && !heures.includes(h)) heures.push(h);
      });
    }

    // Format 3: regex brute sur le texte du bloc
    if (!heures.length) {
      $c.text().match(/\b(\d{1,2})h(\d{2})\b/g)?.forEach(t => {
        if (!heures.includes(t)) heures.push(t);
      });
    }

    if (!heures.length) return;

    results.push({ title, director, duration, genre, heures: heures.sort() });
  });

  // Fallback total: si 0 films parsés, chercher dans tout le HTML
  if (!results.length) {
    // Chercher tous les blocs de texte contenant des horaires
    const allText = $('body').text();
    const hourMatches = allText.match(/\b(\d{1,2})h(\d{2})\b/g) || [];
    if (hourMatches.length > 3) {
      console.log(`    ℹ Fallback regex: ${hourMatches.length} horaires trouvés dans le HTML brut`);
      // On ne peut pas associer les films sans la structure, mais on log pour debug
    }
    
    // Essai avec data-json dans les scripts
    $('script[type="application/json"], script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '{}');
        // ld+json Movie schema
        if (json['@type'] === 'Movie' || json.name) {
          const title = json.name;
          const heures = (json.workPresented || json.offers || [])
            .map(o => toHeure(o.availabilityStarts || o.startDate))
            .filter(Boolean);
          if (title && heures.length) results.push({ title, heures });
        }
      } catch (e) {}
    });
  }

  return results;
}

// ─── SCRAPING PRINCIPAL ───────────────────────────────────────────────────────
async function scrapeCinema(cinemaId, cinema) {
  console.log(`\n📍 ${cinemaId} (${cinema.allocineId})...`);
  const result = { films: {}, seances: {} };

  for (let day = 0; day < DAYS; day++) {
    const dateISO = getDateISO(day);
    
    // URL AlloCiné: jour J = page de base, jours suivants = ?date=YYYY-MM-DD
    const url = day === 0
      ? `https://www.allocine.fr/seance/salle_gen_csalle=${cinema.allocineId}.html`
      : `https://www.allocine.fr/seance/salle_gen_csalle=${cinema.allocineId}.html?date=${dateISO}`;

    console.log(`  📅 ${dateISO} → ${url}`);
    
    const html = await fetchPage(url);
    if (!html) { console.log(`    ✗ Fetch échoué`); continue; }

    const seancesJour = parseAllocineHTML(html, dateISO);

    
    for (const { title, director, duration, genre, heures } of seancesJour) {
      if (!result.films[title]) {
        result.films[title] = { title, director: director||'', duration: duration||'', genre: genre||'' };
      }
      if (!result.seances[title]) result.seances[title] = {};
      result.seances[title][dateISO] = [...new Set(heures)].sort();
    }

    const total = Object.values(result.seances).reduce((s, fd) => s + (fd[dateISO]||[]).length, 0);
    console.log(`    ✓ ${seancesJour.length} films, ${total} horaires`);
    
    if (seancesJour.length > 0) {
      const ex = seancesJour[0];
      console.log(`    Ex: "${ex.title}" → ${ex.heures.join(', ')}`);
    }

    await sleep(800);
  }

  return result;
}

// ─── ENRICHISSEMENT TMDB ──────────────────────────────────────────────────────
async function enrichWithTMDB(films) {
  console.log('\n🎬 Enrichissement TMDB...');
  for (const [, film] of Object.entries(films)) {
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(film.title)}&language=fr-FR&region=FR`,
        { headers: { Authorization: `Bearer ${TMDB_TOKEN}` }, timeout: 8000 }
      );
      if (!res.ok) continue;
      const { results } = await res.json();
      const movie = results?.[0];
      if (!movie) continue;
      film.tmdbId  = movie.id;
      film.poster  = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null;
      film.tmdbNote = movie.vote_average ? +movie.vote_average.toFixed(1) : null;
      if (!film.synopsis) film.synopsis = movie.overview || '';

      const vRes = await fetch(
        `https://api.themoviedb.org/3/movie/${movie.id}/videos?language=fr-FR`,
        { headers: { Authorization: `Bearer ${TMDB_TOKEN}` }, timeout: 8000 }
      );
      if (vRes.ok) {
        const { results: vids } = await vRes.json();
        const t = vids?.find(v => v.type==='Trailer' && v.site==='YouTube') || vids?.find(v => v.site==='YouTube');
        if (t) film.trailerKey = t.key;
      }
      console.log(`  ✓ "${film.title}" → ${movie.id}${film.trailerKey ? ' + trailer' : ''}`);
      await sleep(250);
    } catch (e) {}
  }
}

// ─── PUSH SUPABASE ────────────────────────────────────────────────────────────
async function pushToSupabase(allData) {
  console.log('\n📤 Push Supabase...');

  // Cinémas
  await supa.from('cinemas_dyn').upsert(
    Object.entries(CINEMAS).map(([id, c]) => ({
      id, name: c.name, chain: c.chain, lat: c.lat, lng: c.lng,
      addr: c.addr, metro: c.metro, allocine_id: c.allocineId,
    })), { onConflict: 'id' }
  );

  // Films
  const allFilms = {};
  for (const { films } of Object.values(allData)) {
    for (const [title, f] of Object.entries(films)) {
      const slug = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
                        .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      if (!allFilms[slug]) allFilms[slug] = { ...f, slug };
    }
  }
  await enrichWithTMDB(allFilms);
  await supa.from('films_dyn').upsert(
    Object.entries(allFilms).map(([slug, f]) => ({
      id: slug, title: f.title, director: f.director||'', duration: f.duration||'',
      genre: f.genre||'', synopsis: f.synopsis||'', poster_url: f.poster||null,
      tmdb_id: f.tmdbId||null, tmdb_note: f.tmdbNote||null, trailer_key: f.trailerKey||null,
      updated_at: new Date().toISOString(),
    })), { onConflict: 'id' }
  );

  // Séances
  await supa.from('seances_dyn').delete().lt('date', getDateISO());
  const rows = [];
  for (const [cinemaId, { seances }] of Object.entries(allData)) {
    for (const [title, dateMap] of Object.entries(seances)) {
      const slug = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
                        .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      for (const [date, heures] of Object.entries(dateMap)) {
        if (heures.length) rows.push({ cinema_id: cinemaId, film_id: slug, date, heures });
      }
    }
  }
  for (let i = 0; i < rows.length; i += 100) {
    await supa.from('seances_dyn').upsert(rows.slice(i, i+100), { onConflict: 'cinema_id,film_id,date' });
  }
  console.log(`✅ ${Object.keys(allFilms).length} films, ${rows.length} séances`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🎬 CinéMatch Scraper v4 — ' + new Date().toLocaleString('fr-FR'));
  console.log(DRY_RUN ? '🔍 DRY-RUN' : '🚀 PRODUCTION');
  console.log(`📅 ${DAYS} jours : ${getDateISO(0)} → ${getDateISO(DAYS-1)}`);
  console.log('─'.repeat(50));

  const allData = {};
  for (const [id, cinema] of Object.entries(CINEMAS)) {
    try { allData[id] = await scrapeCinema(id, cinema); }
    catch (e) { console.error(`❌ ${id}:`, e.message); allData[id] = { films:{}, seances:{} }; }
    await sleep(400);
  }

  // Résumé
  let totalFilms = new Set(), totalSeances = 0;
  for (const [cid, data] of Object.entries(allData)) {
    const nf = Object.keys(data.films).length;
    const ns = Object.values(data.seances).reduce((s,fd) => s + Object.values(fd).reduce((a,h)=>a+h.length,0), 0);
    Object.keys(data.films).forEach(t => totalFilms.add(t));
    totalSeances += ns;
    console.log(`  ${nf>0?'✓':'✗'} ${cid}: ${nf} films, ${ns} séances`);
  }
  console.log(`\n📊 TOTAL: ${totalFilms.size} films, ${totalSeances} séances`);

  if (DRY_RUN) {
    const ex = Object.entries(allData).find(([,d]) => Object.keys(d.seances).length > 0);
    if (ex) {
      console.log(`\n🔍 Exemple (${ex[0]}):`);
      Object.entries(ex[1].seances).slice(0,3).forEach(([t,dates]) => {
        console.log(`  "${t}":`);
        Object.entries(dates).forEach(([d,h]) => console.log(`    ${d}: ${h.join(', ')}`));
      });
    }
    return;
  }

  if (!SUPA_KEY) { console.error('❌ SUPABASE_SERVICE_KEY manquante'); process.exit(1); }
  await pushToSupabase(allData);
}

main().catch(e => { console.error('❌ Fatal:', e); process.exit(1); });
