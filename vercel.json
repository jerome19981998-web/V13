// api/programme.js — Vercel Serverless Function
// Récupère le programme AlloCiné pour UGC, Pathé, Gaumont Paris
// Mis en cache 6h — se rafraîchit automatiquement

const ALLOCINE_PARTNER = 'QUNXZWItQWxsb0Npbuk';
const ALLOCINE_BASE = 'https://api.allocine.fr/rest/v3';

// IDs AlloCiné des cinémas UGC / Pathé / Gaumont Paris
const THEATERS = [
  // UGC
  { id: 'P0048', key: 'ugc-halles',      chain: 'ugc',    name: 'UGC Ciné Cité Les Halles',     metro: 'M° Les Halles / Châtelet', addr: 'Forum des Halles · 75001', salles: 27, tech: ['IMAX','Dolby Atmos'] },
  { id: 'P0633', key: 'ugc-bercy',       chain: 'ugc',    name: 'UGC Ciné Cité Bercy',          metro: 'M° Cour St-Émilion',       addr: 'Cour Saint-Émilion · 75012', salles: 18, tech: ['4DX','Dolby'] },
  { id: 'P0682', key: 'ugc-paris19',     chain: 'ugc',    name: "UGC Ciné Cité Paris 19",       metro: 'Tram T3b Ella Fitzgerald',  addr: "Rue de l'Orient-Express · 75019", salles: 14, tech: [] },
  { id: 'P0085', key: 'ugc-maillot',     chain: 'ugc',    name: 'UGC Maillot',                  metro: 'M° Porte Maillot',         addr: 'Palais des Congrès · 75017', salles: 12, tech: ['Dolby Atmos'] },
  { id: 'P0886', key: 'ugc-opera',       chain: 'ugc',    name: 'UGC Opéra',                    metro: 'M° Opéra',                 addr: '34 Bd des Italiens · 75009', salles: 4, tech: [] },
  { id: 'P0040', key: 'ugc-normandie',   chain: 'ugc',    name: 'UGC Normandie',                metro: 'M° Charles de Gaulle-Étoile', addr: '116 Av. Champs-Élysées · 75008', salles: 1, tech: ['Grand Écran · 700 places'] },
  { id: 'P0036', key: 'ugc-danton',      chain: 'ugc',    name: 'UGC Danton',                   metro: "M° Odéon",                 addr: '99 Bd Saint-Germain · 75006', salles: 4, tech: [] },
  { id: 'P0037', key: 'ugc-odeon',       chain: 'ugc',    name: 'UGC Odéon',                    metro: "M° Odéon",                 addr: '124 Bd Saint-Germain · 75006', salles: 5, tech: [] },
  { id: 'P0038', key: 'ugc-montparnasse',chain: 'ugc',    name: 'UGC Montparnasse',             metro: 'M° Montparnasse-Bienvenüe', addr: '83 Bd Montparnasse · 75006', salles: 7, tech: [] },
  { id: 'P0039', key: 'ugc-rotonde',     chain: 'ugc',    name: 'UGC Rotonde',                  metro: 'M° Vavin',                 addr: '103 Bd Montparnasse · 75014', salles: 3, tech: [] },
  { id: 'P0041', key: 'ugc-lyon',        chain: 'ugc',    name: 'UGC Lyon-Bastille',            metro: 'M° Gare de Lyon',          addr: '12 Rue de Lyon · 75012', salles: 7, tech: [] },
  { id: 'P0135', key: 'ugc-gobelins',    chain: 'ugc',    name: 'UGC Gobelins',                 metro: 'M° Les Gobelins',          addr: '66 Av. des Gobelins · 75013', salles: 3, tech: [] },
  // Pathé
  { id: 'P0165', key: 'pathe-opera',     chain: 'pathe',  name: 'Pathé Opéra Premier',          metro: 'M° Opéra',                 addr: '2 Bd des Capucines · 75009', salles: 7, tech: ['Dolby Vision','Dolby Atmos','Recliner'] },
  { id: 'P0166', key: 'pathe-parnasse',  chain: 'pathe',  name: 'Pathé Parnasse',               metro: 'M° Mouton-Duvernet',       addr: '73 Av. du Gal Leclerc · 75014', salles: 12, tech: ['Laser 4K','Dolby Atmos'] },
  { id: 'P0755', key: 'pathe-baugrenelle',chain:'pathe',  name: 'Pathé Baugrenelle',            metro: 'M° Charles Michels',       addr: 'Rue Linois · 75015', salles: 12, tech: ['Dolby Atmos','ScreenX'] },
  { id: 'P0572', key: 'pathe-wepler',    chain: 'pathe',  name: 'Pathé Wepler',                 metro: 'M° Place de Clichy',       addr: '140 Bd de Clichy · 75018', salles: 11, tech: ['4DX','ScreenX','Dolby'] },
  { id: 'P0883', key: 'pathe-bnp',       chain: 'pathe',  name: 'Pathé BNP Paribas',            metro: 'M° Opéra',                 addr: '2 Rue Louis-le-Grand · 75002', salles: 6, tech: ['Dolby'] },
  { id: 'P0776', key: 'pathe-batignolles',chain:'pathe',  name: 'Pathé Les 7 Batignolles',      metro: 'M° Brochant',              addr: '145 Rue Cardinet · 75017', salles: 7, tech: ['Dolby Atmos','Laser 4K'] },
  // Gaumont
  { id: 'P0034', key: 'gaumont-opera',   chain: 'gaumont',name: 'Gaumont Opéra Capucines',      metro: 'M° Opéra',                 addr: '2 Bd des Capucines · 75009', salles: 7, tech: ['Dolby'] },
  { id: 'P0035', key: 'gaumont-convention',chain:'gaumont',name:'Gaumont Convention',           metro: 'M° Convention',            addr: '27 Rue A. Chartier · 75015', salles: 9, tech: ['4DX','Dolby Atmos'] },
  { id: 'P0168', key: 'gaumont-alesia',  chain: 'gaumont',name: 'Gaumont Alésia',               metro: 'M° Alésia',                addr: '73 Av. du Gal Leclerc · 75014', salles: 12, tech: ['Dolby Cinema','Laser 4K'] },
];

// Icônes par chaîne
const CHAIN_ICON = { ugc: '🎬', pathe: '🎭', gaumont: '🎬' };

// Emoji et couleurs de fond pour les films selon leur genre
function filmStyle(genres) {
  const g = (genres || '').toLowerCase();
  if (g.includes('horreur') || g.includes('thriller'))  return { e: '🔪', c: '#8b0000', bg: 'linear-gradient(135deg,#1a0000,#8b0000)' };
  if (g.includes('animation') || g.includes('famille')) return { e: '🦊', c: '#1e6899', bg: 'linear-gradient(135deg,#0a1a2a,#1e6899)' };
  if (g.includes('comédie') || g.includes('comedie'))   return { e: '😂', c: '#0a3060', bg: 'linear-gradient(135deg,#0a1020,#0a3060)' };
  if (g.includes('romance') || g.includes('romantique'))return { e: '🌧️', c: '#2a2030', bg: 'linear-gradient(135deg,#1a1520,#2a2030)' };
  if (g.includes('documentaire') || g.includes('doc'))  return { e: '🎙️', c: '#1a3060', bg: 'linear-gradient(135deg,#0a1020,#1a3060)' };
  if (g.includes('aventure') || g.includes('action'))   return { e: '⚡', c: '#3a1060', bg: 'linear-gradient(135deg,#0d0d1a,#3a1060)' };
  if (g.includes('science') || g.includes('sf'))        return { e: '🚀', c: '#0a2a4a', bg: 'linear-gradient(135deg,#0a0a1a,#0a2a4a)' };
  if (g.includes('biopic') || g.includes('histoire'))   return { e: '📖', c: '#1a3a1a', bg: 'linear-gradient(135deg,#0a0a0a,#1a3a1a)' };
  // drame par défaut
  return { e: '🎭', c: '#4a3010', bg: 'linear-gradient(135deg,#1a1510,#4a3010)' };
}

// Formate une heure AlloCiné "2026-03-08T20:15:00+01:00" → "20h15"
function formatHeure(dateStr) {
  try {
    const d = new Date(dateStr);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}h${m}`;
  } catch { return null; }
}

// Calcule la durée en "Xh Y min" depuis les minutes AlloCiné
function formatDuree(minutes) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m < 10 ? '0' : ''}${m}` : `${h}h`;
}

// Slug unique pour un film depuis son titre
function slugify(title) {
  return title.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
}

// Fetch avec timeout
async function fetchJSON(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'CineMatch/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Récupère les séances d'un cinéma via AlloCiné pour une date donnée
async function fetchSeances(theaterId, dateStr) {
  const url = `${ALLOCINE_BASE}/showtimelist?partner=${ALLOCINE_PARTNER}&theaters=${theaterId}&date=${dateStr}&format=json`;
  try {
    const data = await fetchJSON(url);
    return data?.feed?.theaterShowtimes || [];
  } catch (e) {
    console.error(`Erreur cinéma ${theaterId}:`, e.message);
    return [];
  }
}

// Cache in-memory par date (reset à chaque cold-start)
let cache = {};
let cacheTime = {};
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 heures

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate');

  // Lire la date demandée (défaut = aujourd'hui)
  const requestedDate = req.query?.date || new Date().toISOString().split('T')[0];
  // Valider le format YYYY-MM-DD
  const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
    ? requestedDate
    : new Date().toISOString().split('T')[0];

  // Cache par date
  const cacheKey = dateStr;
  if (cache?.[cacheKey] && Date.now() - (cacheTime?.[cacheKey] || 0) < CACHE_TTL) {
    return res.status(200).json(cache[cacheKey]);
  }

  try {
    // Récupérer toutes les salles en parallèle (par batch de 5 pour éviter le rate-limit)
    const films = {};   // id → données film
    const cinemas = []; // liste des cinémas avec leurs films/horaires

    // Batch les requêtes par 5
    const batchSize = 5;
    const allSeances = [];
    for (let i = 0; i < THEATERS.length; i += batchSize) {
      const batch = THEATERS.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(t => fetchSeances(t.id, dateStr)));
      allSeances.push(...results);
      if (i + batchSize < THEATERS.length) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    // Construire la structure cinémas + films
    for (let idx = 0; idx < THEATERS.length; idx++) {
      const theater = THEATERS[idx];
      const seances = allSeances[idx];
      const cinemaFilms = [];

      for (const showtime of seances) {
        const movieData = showtime.onShowtimeMovie || showtime.movie || {};
        const title = movieData.title || movieData.originalTitle;
        if (!title) continue;

        const filmId = slugify(title);
        const horaires = [];
        const versions = new Set();

        // Extraire les horaires
        const screentimes = showtime.scr || [];
        for (const scr of screentimes) {
          const h = formatHeure(scr?.d || scr?.showtime);
          if (h) horaires.push(h);
          // Version VF/VOST
          const versionCode = scr?.version?.['$'] || scr?.version?.code;
          if (versionCode === 3) versions.add('VOST');
          else if (versionCode === 2) versions.add('VO');
          else versions.add('VF');
        }

        if (horaires.length === 0) continue;

        // Dédupliquer et trier les horaires
        const horairesSorted = [...new Set(horaires)].sort();

        // Enregistrer le film si nouveau
        if (!films[filmId]) {
          const genreList = (movieData.genre || []).map(g => g?.['$'] || g?.name || '').join(', ');
          const stats = filmStyle(genreList);
          const directors = (movieData.castingShort?.directors || '').split(',')[0].trim();
          const duree = formatDuree(movieData.runtime);
          films[filmId] = {
            e: stats.e,
            c: stats.c,
            bg: stats.bg,
            g: (movieData.genre?.[0]?.['$'] || movieData.genre?.[0]?.name || 'DRAME').toUpperCase(),
            t: title,
            d: duree || '?',
            dir: directors || '?',
            s: movieData.synopsisShort || movieData.synopsis || '',
            lbd: false,
          };
        }

        cinemaFilms.push({
          id: filmId,
          h: horairesSorted,
          v: [...versions],
          g: [],
        });
      }

      if (cinemaFilms.length > 0) {
        cinemas.push({
          id: theater.key,
          chain: theater.chain,
          icon: CHAIN_ICON[theater.chain] || '🎬',
          name: theater.name,
          addr: theater.addr,
          metro: theater.metro,
          salles: theater.salles,
          tech: theater.tech,
          films: cinemaFilms,
        });
      }
    }

    const result = { films, cinemas, date: dateStr, updatedAt: new Date().toISOString() };
    cache[cacheKey] = result;
    cacheTime[cacheKey] = Date.now();

    return res.status(200).json(result);
  } catch (err) {
    console.error('Erreur programme:', err);
    return res.status(500).json({ error: err.message });
  }
}
