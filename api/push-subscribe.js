// POST /api/push-subscribe
// Saves user's push subscription to Supabase
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  if (req.method !== 'POST') return res.status(405).end();

  const { subscription, userId } = req.body;
  if (!subscription || !userId) return res.status(400).json({ error: 'Missing params' });

  const SUPA_URL = process.env.SUPABASE_URL;
  const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY;

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
    if (!r.ok) throw new Error(await r.text());
    return res.json({ ok: true });
  } catch (e) {
    console.error('push-subscribe:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
