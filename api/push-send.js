const webpush = require('web-push');

// POST /api/push-send
// Sends a push notification to one or multiple users
// Called internally by other API routes (message sent, friend request, etc.)

const VAPID_SUBJECT = 'mailto:contact@cinematch.app';


// ── Simplified approach: use web-push npm package ──────────────────────────
// Since implementing RFC 8291 from scratch is complex, use the npm package
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY;
  const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
  const SUPA_URL = process.env.SUPABASE_URL;
  const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return res.status(500).json({ error: 'VAPID not configured' });

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  const { userIds, notification } = req.body;
  // userIds: string[] — users to notify
  // notification: { title, body, icon, url, tag }

  if (!userIds?.length || !notification) return res.status(400).json({ error: 'Missing params' });

  // Get subscriptions for these users
  const ids = userIds.map(id => `"${id}"`).join(',');
  const subRes = await fetch(
    `${SUPA_URL}/rest/v1/push_subscriptions?user_id=in.(${ids})&select=*`,
    { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } }
  );
  const subs = await subRes.json();

  const results = await Promise.allSettled(
    (subs || []).map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        JSON.stringify({
          title: notification.title || 'CinéMatch 🎬',
          body: notification.body,
          icon: '/icon-192.png',
          badge: '/icon-96.png',
          tag: notification.tag || 'cinematch',
          url: notification.url || '/',
          data: notification.data || {},
        })
      ).catch(async err => {
        // 410 Gone = subscription expired, delete it
        if (err.statusCode === 410) {
          await fetch(`${SUPA_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`, {
            method: 'DELETE',
            headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
          });
        }
        throw err;
      })
    )
  );

  const sent = results.filter(r => r.status === 'fulfilled').length;
  return res.json({ ok: true, sent, total: subs?.length || 0 });
}
