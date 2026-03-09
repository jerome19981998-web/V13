/**
 * CinéMatch — Scraper AlloCiné
 * 
 * Récupère les films et séances des 17 cinémas Paris
 * et met à jour Supabase automatiquement.
 * 
 * Usage:
 *   node scraper.js           → scrape + push Supabase
 *   node scraper.js --dry-run → scrape + affiche sans push
 */

const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');

// ─── CONFIG SUPABASE ────────────────────────────────────────────────────────
const SUPA_URL = process.env.SUPABASE_URL || 'https://alwfbminhdwinxcozjlj.supabase.co';
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY; // Service key (pas anon) pour écriture
const supa = !DRY_RUN ? createClient(SUPA_URL, SUPA_KEY) : null;

// ─── MAPPING CINÉMAS (nos IDs → IDs AlloCiné) ───────────────────────────────
// AlloCiné identifie les cinémas par un code numérique dans les URLs
// Format: https://www.allocine.fr/seance/salle_gen_csalle=PXXXXX.html
const CINEMA_ALLOCINE = {
  'ugc-halles':           { allocineId: 'P0647', name: 'UGC Ciné Cité Les Halles',   chain: 'ugc',    lat: 48.8609, lng: 2.3474, addr: '7 pl. de la Rotonde',        metro: 'Les Halles',      salles: 27, tech: ['Dolby','4DX','ICE'] },
  'ugc-bercy':            { allocineId: 'P0648', name: 'UGC Ciné Cité Bercy',         chain: 'ugc',    lat: 48.8302, lng: 2.3789, addr: '2 cour Saint-Émilion',       metro: 'Cour St-Émilion', salles: 18, tech: ['Dolby','ICE'] },
  'ugc-paris19':          { allocineId: 'P0649', name: 'UGC Ciné Cité Paris 19',      chain: 'ugc',    lat: 48.8866, lng: 2.3780, addr: '1 rue du Bassin',            metro: 'Corentin Cariou', salles: 14, tech: ['Dolby','ICE'] },
  'ugc-maillot':          { allocineId: 'P0650', name: 'UGC Maillot',                 chain: 'ugc',    lat: 48.8794, lng: 2.2830, addr: '2 pl. Porte Maillot',        metro: 'Porte Maillot',   salles: 12, tech: ['Dolby'] },
  'ugc-opera':            { allocineId: 'P0645', name: 'UGC Opéra',                   chain: 'ugc',    lat: 48.8719, lng: 2.3387, addr: '34 bd des Italiens',         metro: 'Opéra',           salles: 4,  tech: ['Dolby'] },
  'ugc-danton':           { allocineId: 'P0646', name: 'UGC Danton',                  chain: 'ugc',    lat: 48.8527, lng: 2.3411, addr: '99 bd du Montparnasse',      metro: 'Vavin',           salles: 4,  tech: [] },
  'ugc-montparnasse':     { allocineId: 'P0651', name: 'UGC Montparnasse',             chain: 'ugc',    lat: 48.8424, lng: 2.3244, addr: '103 bd du Montparnasse',     metro: 'Vavin',           salles: 3,  tech: [] },
  'ugc-lyon':             { allocineId: 'P0652', name: 'UGC Lyon-Bastille',            chain: 'ugc',    lat: 48.8448, lng: 2.3731, addr: '12 rue de Lyon',             metro: 'Gare de Lyon',    salles: 7,  tech: ['Dolby'] },
  'pathe-beaugrenelle':   { allocineId: 'P0614', name: 'Pathé Beaugrenelle',           chain: 'pathe',  lat: 48.8473, lng: 2.2894, addr: '7 rue Linois',               metro: 'Charles Michels', salles: 10, tech: ['Dolby','4DX','ScreenX'] },
  'pathe-convention':     { allocineId: 'P0617', name: 'Pathé Convention',             chain: 'pathe',  lat: 48.8396, lng: 2.3087, addr: '27 rue Alain-Chartier',      metro: 'Convention',      salles: 8,  tech: ['Dolby'] },
  'pathe-parnasse':       { allocineId: 'P0618', name: 'Pathé Parnasse',               chain: 'pathe',  lat: 48.8429, lng: 2.3334, addr: '3 rue du Départ',            metro: 'Montparnasse',    salles: 6,  tech: ['Dolby'] },
  'pathe-wepler':         { allocineId: 'P0615', name: 'Pathé Wepler',                 chain: 'pathe',  lat: 48.8842, lng: 2.3272, addr: '14 pl. de Clichy',           metro: 'Place de Clichy', salles: 8,  tech: ['Dolby'] },
  'pathe-alesia':         { allocineId: 'P0616', name: 'Pathé Alésia',                 chain: 'pathe',  lat: 48.8272, lng: 2.3264, addr: '73 av. du Gal Leclerc',      metro: 'Alésia',          salles: 6,  tech: ['Dolby'] },
  'pathe-batignolles':    { allocineId: 'P0613', name: 'Les 7 Batignolles',            chain: 'pathe',  lat: 48.8861, lng: 2.3189, addr: '6 rue Hélène',               metro: 'Brochant',        salles: 7,  tech: [] },
  'gaumont-opera':        { allocineId: 'P0573', name: 'Gaumont Opéra Premier',        chain: 'gaumont',lat: 48.8701, lng: 2.3308, addr: '2 bd des Capucines',         metro: 'Opéra',           salles: 8,  tech: ['Dolby','4DX'] },
  'gaumont-convention':   { allocineId: 'P0574', name: 'Gaumont Convention',           chain: 'gaumont',lat: 48.8392, lng: 2.3089, addr: '27 rue Alain-Chartier',      metro: 'Convention',      salles: 9,  tech: ['Dolby'] },
  'gaumont-aquaboulevard':{ allocineId: 'P0575', name: 'Gaumont Aquaboulevard',        chain: 'gaumont',lat: 48.8314, lng: 2.2783, addr: '8 rue Colonel Pierre Avia',  metro: 'Balard',          salles: 10, tech: ['Dolby','4DX'] },
};

// ─── HELPERS ────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
};

async function fetchPage(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS, timeout: 15000 });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      console.warn(`  ⚠ Tentative ${i+1}/${retries} échouée pour ${url}: ${e.message}`);
      if (i < retries - 1) await sleep(2000 * (i + 1));
    }
  }
  return null;
}

// Normalise une heure "14h30", "14:30", "14H30" → "14h30"
function normalizeHeure(str) {
  if (!str) return null;
  return str.trim().toLowerCase().replace(':', 'h').replace(/h$/, 'h00');
}

// Normalise une date → "YYYY-MM-DD"
function normalizeDate(str) {
  if (!str) return null;
  // AlloCiné: "lun. 9 mars" ou "2026-03-09"
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const mois = { jan: '01', fév: '02', mar: '03', avr: '04', mai: '05',
                 jun: '06', jul: '07', aoû: '08', sep: '09', oct: '10',
                 nov: '11', déc: '12', 'mars': '03', 'avril': '04',
                 'janvier': '01', 'février': '02', 'juin': '06',
                 'juillet': '07', 'août': '08', 'septembre': '09',
                 'octobre': '10', 'novembre': '11', 'décembre': '12' };
  const match = str.match(/(\d{1,2})\s+([a-zéûôâ]+)/i);
  if (!match) return null;
  const day = match[1].padStart(2, '0');
  const month = mois[match[2].toLowerCase().substring(0, 4).replace('é','é')] ||
                mois[match[2].toLowerCase().substring(0, 3)];
  if (!month) return null;
  const year = new Date().getFullYear();
  // Si le mois est dans le passé, c'est l'année prochaine
  const d = new Date(`${year}-${month}-${day}`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const date = d < now ? `${year + 1}-${month}-${day}` : `${year}-${month}-${day}`;
  return date;
}

// ─── SCRAPING ALLOCINÉ ───────────────────────────────────────────────────────

/**
 * Scrape les séances d'UN cinéma sur 7 jours
 * URL: https://www.allocine.fr/seance/salle_gen_csalle=P0647.html
 * + /date_1, /date_2... pour les jours suivants
 */
async function scrapeCinema(cinemaId, allocineId) {
  console.log(`\n📍 Scraping ${cinemaId} (AlloCiné: ${allocineId})...`);
  
  const result = {
    films: {},  // { filmTitle: { title, director, duration, genre, synopsis, tmdbId } }
    seances: {} // { filmTitle: { 'YYYY-MM-DD': ['14h30', '17h00', ...] } }
  };

  // Scraper 7 jours
  // Format AlloCiné: aujourd'hui = /salle_gen_csalle=P0647.html
  // Jours suivants = /salle_gen_csalle=P0647/date-2026-03-10/
  for (let day = 0; day < 7; day++) {
    const dateObj = new Date();
    dateObj.setDate(dateObj.getDate() + day);
    const dateISO = dateObj.toISOString().slice(0, 10); // "2026-03-09"
    const url = day === 0
      ? `https://www.allocine.fr/seance/salle_gen_csalle=${allocineId}.html`
      : `https://www.allocine.fr/seance/salle_gen_csalle=${allocineId}/date-${dateISO}/`;
    
    const html = await fetchPage(url);
    if (!html) { console.log(`  ⚠ Jour ${day} ignoré (fetch échoué)`); continue; }
    
    const $ = cheerio.load(html);
    
    // Date déjà calculée depuis dateISO
    const dateStr = dateISO;

    console.log(`  📅 Jour ${day}: ${dateStr}`);

    // Parcourir chaque film affiché
    // Structure AlloCiné: .card.entity-card pour chaque film + .showtimes-list pour les horaires
    let filmsFound = 0;

    // Sélecteurs AlloCiné (peuvent changer - on essaie plusieurs)
    const filmSections = $('.showtimes-movie-card, .movie-card-showtimes, [class*="movie"][class*="card"]');
    
    filmSections.each((_, section) => {
      const $s = $(section);
      
      // Titre du film
      let title = $s.find('.meta-title-link, .movie-card-title, h2 a, .title a').first().text().trim();
      if (!title) title = $s.find('a[href*="/film/"]').first().text().trim();
      if (!title) return;

      // Infos film
      const director = $s.find('.meta-director, [class*="director"]').first().text().trim().replace(/^de\s+/i, '');
      const durationRaw = $s.find('.meta-duration, [class*="duration"]').first().text().trim();
      const duration = durationRaw.replace(/\s+/g, '').replace('h', 'h').replace('min', '');
      const genre = $s.find('.meta-genre, [class*="genre"]').first().text().trim();

      if (!result.films[title]) {
        result.films[title] = { title, director, duration, genre };
      }
      if (!result.seances[title]) result.seances[title] = {};
      if (!result.seances[title][dateStr]) result.seances[title][dateStr] = [];

      // Horaires
      $s.find('.showtimes-version-runtime button, .showtimes-day button, [data-showtime-ue-element] span, .showtime-button, .showtimes button').each((_, btn) => {
        const timeText = $(btn).text().trim();
        const h = normalizeHeure(timeText);
        if (h && /^\d{1,2}h\d{2}$/.test(h) && !result.seances[title][dateStr].includes(h)) {
          result.seances[title][dateStr].push(h);
        }
      });

      // Fallback: chercher les heures dans le texte avec regex
      if (result.seances[title][dateStr].length === 0) {
        const text = $s.text();
        const matches = text.match(/\b(\d{1,2})[h:](\d{2})\b/g) || [];
        matches.forEach(m => {
          const h = normalizeHeure(m);
          if (h && !result.seances[title][dateStr].includes(h)) {
            result.seances[title][dateStr].push(h);
          }
        });
      }

      if (result.seances[title][dateStr].length > 0) filmsFound++;
    });

    // Fallback général si les sélecteurs ne matchent pas
    if (filmsFound === 0) {
      // Essayer une approche plus large
      $('[class*="showtime"]').each((_, el) => {
        const text = $(el).text();
        const timeMatches = text.match(/\b(\d{1,2})[h:](\d{2})\b/g) || [];
        // Chercher le titre le plus proche dans le DOM parent
        let title = $(el).closest('[class*="movie"], [class*="film"]').find('a, h2, h3').first().text().trim();
        if (!title || timeMatches.length === 0) return;
        
        if (!result.films[title]) result.films[title] = { title };
        if (!result.seances[title]) result.seances[title] = {};
        if (!result.seances[title][dateStr]) result.seances[title][dateStr] = [];
        
        timeMatches.forEach(m => {
          const h = normalizeHeure(m);
          if (h && !result.seances[title][dateStr].includes(h)) {
            result.seances[title][dateStr].push(h);
          }
        });
      });
    }

    // Trier les séances
    Object.values(result.seances).forEach(filmDates => {
      if (filmDates[dateStr]) filmDates[dateStr].sort();
    });

    const totalSeances = Object.values(result.seances).reduce((sum, fd) => 
      sum + (fd[dateStr] ? fd[dateStr].length : 0), 0);
    console.log(`  ✓ ${Object.keys(result.films).length} films, ${totalSeances} séances trouvées`);

    // Pause pour ne pas surcharger AlloCiné
    await sleep(800);
  }

  return result;
}

/**
 * Enrichit les films avec les données TMDB (poster, note, bande-annonce)
 */
async function enrichWithTMDB(films) {
  const TMDB_TOKEN = process.env.TMDB_TOKEN || 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIzMzY0M2EwMDRiZGMyYzdlNmIyYTFjOWMzZWI5ZDhlYyIsIm5iZiI6MTc3MzAwMTIzNy42ODYsInN1YiI6IjY5YWRkYTE1MmVmNWMxZmY5NWZjYmNlOCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.bRW2UVqu1p89xPusKV5-mzW4ZeRSk8ij811FWOIwoBM';
  
  console.log('\n🎬 Enrichissement TMDB...');
  
  for (const [title, film] of Object.entries(films)) {
    try {
      const searchUrl = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(title)}&language=fr-FR&region=FR&year=${new Date().getFullYear()}`;
      const res = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${TMDB_TOKEN}` }
      });
      if (!res.ok) continue;
      const data = await res.json();
      const movie = data.results?.[0];
      if (!movie) continue;

      film.tmdbId = movie.id;
      film.poster = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null;
      film.tmdbNote = movie.vote_average ? Math.round(movie.vote_average * 10) / 10 : null;
      film.synopsis = movie.overview || film.synopsis || '';
      film.bg = '#111120'; // sera mis à jour si on a un poster

      // Bande-annonce
      const vidUrl = `https://api.themoviedb.org/3/movie/${movie.id}/videos?language=fr-FR`;
      const vidRes = await fetch(vidUrl, { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } });
      if (vidRes.ok) {
        const vidData = await vidRes.json();
        const trailer = vidData.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
        if (trailer) film.trailerKey = trailer.key;
      }

      console.log(`  ✓ ${title} → TMDB ${movie.id}${film.trailerKey ? ' + trailer' : ''}`);
      await sleep(300);
    } catch (e) {
      console.warn(`  ⚠ TMDB échoué pour "${title}": ${e.message}`);
    }
  }
  return films;
}

// ─── PUSH SUPABASE ───────────────────────────────────────────────────────────

async function pushToSupabase(allData) {
  console.log('\n📤 Push vers Supabase...');
  
  // 1. Upsert cinémas
  const cinemasToUpsert = Object.entries(CINEMA_ALLOCINE).map(([id, c]) => ({
    id,
    name: c.name,
    chain: c.chain,
    lat: c.lat,
    lng: c.lng,
    addr: c.addr,
    metro: c.metro,
    salles: c.salles,
    tech: c.tech,
    allocine_id: c.allocineId,
  }));
  
  const { error: cinError } = await supa.from('cinemas_dyn').upsert(cinemasToUpsert, { onConflict: 'id' });
  if (cinError) console.error('Erreur cinémas:', cinError.message);
  else console.log(`  ✓ ${cinemasToUpsert.length} cinémas mis à jour`);

  // 2. Collecter tous les films uniques
  const allFilms = {};
  for (const { films } of Object.values(allData)) {
    for (const [title, film] of Object.entries(films)) {
      const slug = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      if (!allFilms[slug]) allFilms[slug] = { ...film, slug };
    }
  }

  // Enrichir avec TMDB
  const enrichedFilms = await enrichWithTMDB(allFilms);

  // Upsert films
  const filmsToUpsert = Object.entries(enrichedFilms).map(([slug, f]) => ({
    id: slug,
    title: f.title,
    director: f.director || '',
    duration: f.duration || '',
    genre: f.genre || '',
    synopsis: f.synopsis || '',
    poster_url: f.poster || null,
    tmdb_id: f.tmdbId || null,
    tmdb_note: f.tmdbNote || null,
    trailer_key: f.trailerKey || null,
    updated_at: new Date().toISOString(),
  }));

  const { error: filmError } = await supa.from('films_dyn').upsert(filmsToUpsert, { onConflict: 'id' });
  if (filmError) console.error('Erreur films:', filmError.message);
  else console.log(`  ✓ ${filmsToUpsert.length} films mis à jour`);

  // 3. Séances : supprimer les anciennes + insérer les nouvelles
  // Supprimer séances passées (> aujourd'hui)
  const today = new Date().toISOString().slice(0, 10);
  const { error: delError } = await supa.from('seances_dyn').delete().lt('date', today);
  if (delError) console.error('Erreur suppression séances:', delError.message);

  // Insérer nouvelles séances
  const seancesToInsert = [];
  for (const [cinemaId, { seances, films }] of Object.entries(allData)) {
    for (const [title, dateMap] of Object.entries(seances)) {
      const slug = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      for (const [date, heures] of Object.entries(dateMap)) {
        if (heures.length === 0) continue;
        seancesToInsert.push({
          cinema_id: cinemaId,
          film_id: slug,
          date,
          heures: heures.sort(),
        });
      }
    }
  }

  // Upsert par batch de 100
  for (let i = 0; i < seancesToInsert.length; i += 100) {
    const batch = seancesToInsert.slice(i, i + 100);
    const { error: seanceError } = await supa.from('seances_dyn').upsert(batch, { onConflict: 'cinema_id,film_id,date' });
    if (seanceError) console.error(`Erreur séances batch ${i}:`, seanceError.message);
  }
  
  console.log(`  ✓ ${seancesToInsert.length} séances insérées`);
  console.log(`\n✅ Mise à jour terminée : ${filmsToUpsert.length} films, ${seancesToInsert.length} séances`);
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🎬 CinéMatch Scraper — ' + new Date().toLocaleString('fr-FR'));
  console.log(DRY_RUN ? '🔍 MODE DRY-RUN (aucune écriture Supabase)' : '🚀 MODE PRODUCTION');
  console.log('─'.repeat(50));

  const allData = {};

  // Scraper chaque cinéma avec délai entre chaque
  for (const [cinemaId, cinema] of Object.entries(CINEMA_ALLOCINE)) {
    try {
      allData[cinemaId] = await scrapeCinema(cinemaId, cinema.allocineId);
    } catch (e) {
      console.error(`❌ Erreur pour ${cinemaId}:`, e.message);
      allData[cinemaId] = { films: {}, seances: {} };
    }
    // Délai entre cinémas pour être respectueux
    await sleep(1500);
  }

  // Résumé
  console.log('\n' + '─'.repeat(50));
  console.log('📊 RÉSUMÉ:');
  let totalFilms = new Set();
  let totalSeances = 0;
  for (const [cid, data] of Object.entries(allData)) {
    const nbFilms = Object.keys(data.films).length;
    const nbSeances = Object.values(data.seances).reduce((sum, fd) => 
      sum + Object.values(fd).reduce((s, h) => s + h.length, 0), 0);
    Object.keys(data.films).forEach(t => totalFilms.add(t));
    totalSeances += nbSeances;
    if (nbFilms > 0) console.log(`  ${cid}: ${nbFilms} films, ${nbSeances} séances`);
  }
  console.log(`\n  TOTAL: ${totalFilms.size} films uniques, ${totalSeances} séances`);

  if (DRY_RUN) {
    console.log('\n🔍 DRY-RUN — Données collectées (non envoyées):');
    console.log(JSON.stringify(Object.fromEntries(
      Object.entries(allData).slice(0, 2).map(([k, v]) => [k, {
        films: Object.keys(v.films).slice(0, 3),
        seancesExample: Object.entries(v.seances).slice(0, 2).map(([t, d]) => ({
          film: t,
          dates: Object.keys(d).slice(0, 2),
          heures: Object.values(d)[0]?.slice(0, 4)
        }))
      }])
    ), null, 2));
    return;
  }

  // Push vers Supabase
  if (!SUPA_KEY) {
    console.error('❌ SUPABASE_SERVICE_KEY manquante — set la variable d\'environnement');
    process.exit(1);
  }
  await pushToSupabase(allData);
}

main().catch(e => {
  console.error('❌ Erreur fatale:', e);
  process.exit(1);
});
