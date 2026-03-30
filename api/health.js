// Vercel Serverless Function — scraper health check
// Called by the app to know if data is fresh
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_ANON_KEY;

  if (!supaUrl || !supaKey) {
    return res.status(500).json({ ok: false, error: 'Not configured' });
  }

  try {
    const r = await fetch(`${supaUrl}/rest/v1/scraper_health?select=*&order=ran_at.desc&limit=1`, {
      headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` }
    });
    const rows = await r.json();
    const last = rows?.[0];

    if (!last) return res.json({ ok: false, stale: true, last_run: null });

    const ageMs = Date.now() - new Date(last.ran_at).getTime();
    const ageHours = Math.floor(ageMs / 3600000);
    const stale = ageMs > 26 * 3600 * 1000; // stale if > 26h

    return res.json({
      ok: last.success,
      stale,
      age_hours: ageHours,
      last_run: last.ran_at,
      films_count: last.films_count,
      seances_count: last.seances_count,
      error: last.error_msg || null,
    });
  } catch (e) {
    return res.status(502).json({ ok: false, error: e.message });
  }
}
