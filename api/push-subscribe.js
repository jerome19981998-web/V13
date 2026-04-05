// POST /api/push-subscribe
// Saves user's push subscription to Supabase
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const SUPA_URL = process.env.SUPABASE_URL;
  const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY;

  // Graceful fail if not configured yet
  if (!SUPA_URL || !SUPA_KEY) {
    console.warn('push-subscribe: missing env vars SUPABASE_URL or SUPABASE_SERVICE_KEY');
    return res.status(200).json({ ok: false, reason: 'not_configured' });
  }

  const body = req.body || {};
  const { subscription, userId } = body;
  if (!subscription || !userId) {
    return res.status(400).json({ error: 'Missing subscription or userId' });
  }

  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/push_subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys?.p256dh,
        auth_key: subscription.keys?.auth,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!r.ok) {
      const errText = await r.text();
      // Table doesn't exist yet → not a fatal error
      if (errText.includes('does not exist') || errText.includes('relation')) {
        console.warn('push_subscriptions table not created yet - run migration_push.sql');
        return res.status(200).json({ ok: false, reason: 'table_missing' });
      }
      throw new Error(errText);
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error('push-subscribe:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
