// POST /api/push-subscribe
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const SUPA_URL = process.env.SUPABASE_URL;
  const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPA_URL || !SUPA_KEY) {
    return res.status(200).json({ ok: false, reason: 'not_configured' });
  }

  const { subscription, userId } = req.body || {};
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
        // ON CONFLICT DO UPDATE — upsert sur l'endpoint
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
      // 23505 = unique violation → subscription already exists, that's fine
      if (errText.includes('23505') || errText.includes('duplicate')) {
        return res.json({ ok: true, note: 'already_subscribed' });
      }
      throw new Error(errText);
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error('push-subscribe:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
