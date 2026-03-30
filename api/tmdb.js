// Vercel Serverless Function — proxy TMDB API
// Token stays server-side, never exposed to the browser
export default async function handler(req, res) {
  // CORS: only allow requests from your own domain
  const allowedOrigins = [
    'https://cinematch.vercel.app',
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/,
    'http://localhost:3000',
  ];
  const origin = req.headers.origin || '';
  const originAllowed = allowedOrigins.some(o =>
    typeof o === 'string' ? o === origin : o.test(origin)
  );
  res.setHeader('Access-Control-Allow-Origin', originAllowed ? origin : '');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.TMDB_TOKEN;
  if (!token) return res.status(500).json({ error: 'TMDB not configured' });

  // Only allow specific TMDB endpoints (whitelist)
  const { path, ...params } = req.query;
  const allowed = [
    'search/movie',
    'movie/now_playing',
    /^movie\/\d+\/videos$/,
    /^movie\/\d+\/credits$/,
  ];
  const pathAllowed = allowed.some(p =>
    typeof p === 'string' ? p === path : p.test(path)
  );
  if (!pathAllowed) return res.status(403).json({ error: 'Endpoint not allowed' });

  // Rate limiting: 100 req/min per IP (simple in-memory, good enough for small scale)
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  if (!global._rl) global._rl = {};
  const now = Date.now();
  if (!global._rl[ip]) global._rl[ip] = [];
  global._rl[ip] = global._rl[ip].filter(t => now - t < 60000);
  if (global._rl[ip].length > 100) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  global._rl[ip].push(now);

  // Build TMDB URL
  const qs = new URLSearchParams({ ...params, language: params.language || 'fr-FR' });
  const tmdbUrl = `https://api.themoviedb.org/3/${path}?${qs}`;

  try {
    const response = await fetch(tmdbUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    const data = await response.json();

    // Cache for 1 hour (TMDB data doesn't change that fast)
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(response.status).json(data);
  } catch (e) {
    return res.status(502).json({ error: 'TMDB upstream error' });
  }
}
