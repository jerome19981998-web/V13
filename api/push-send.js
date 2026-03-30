// POST /api/push-send
// Sends a push notification to one or multiple users
// Called internally by other API routes (message sent, friend request, etc.)

const VAPID_SUBJECT = 'mailto:contact@cinematch.app';

async function sendWebPush(subscription, payload, vapidKeys) {
  const endpoint = subscription.endpoint;
  const auth = subscription.auth_key;
  const p256dh = subscription.p256dh;

  // Build VAPID JWT
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const expiry = Math.floor(Date.now() / 1000) + 12 * 3600; // 12h

  // Import VAPID private key
  const privKeyBytes = base64UrlDecode(vapidKeys.private);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    toPkcs8Der(privKeyBytes),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  );

  const header = base64UrlEncode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = base64UrlEncode(JSON.stringify({ aud: audience, exp: expiry, sub: VAPID_SUBJECT }));
  const sigInput = `${header}.${claims}`;
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(sigInput)
  );
  const jwt = `${sigInput}.${base64UrlEncode(Buffer.from(sig))}`;

  // Encrypt payload using Web Push encryption (RFC 8291)
  const encrypted = await encryptPayload(JSON.stringify(payload), p256dh, auth);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt},k=${vapidKeys.public}`,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      TTL: '86400',
      Urgency: payload.urgency || 'normal',
    },
    body: encrypted,
  });

  return response.status;
}

// ── Simplified approach: use web-push npm package ──────────────────────────
// Since implementing RFC 8291 from scratch is complex, use the npm package
const webpush = require('web-push');

export default async function handler(req, res) {
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
