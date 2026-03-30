// GET /api/push-reminders
// Vercel Cron Job — runs every hour
// Sends reminder notifications for sorties happening in ~24h and ~1h

export const config = {
  maxDuration: 30,
};

export default async function handler(req, res) {
  // Sécurité: Vercel cron envoie un header Authorization
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const SUPA_URL = process.env.SUPABASE_URL;
  const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY;

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 3600 * 1000);
  const in1h  = new Date(now.getTime() + 1 * 3600 * 1000);
  const in25h = new Date(now.getTime() + 25 * 3600 * 1000);
  const in90m = new Date(now.getTime() + 90 * 60 * 1000);

  const toISO = d => d.toISOString().slice(0, 19);
  const today = now.toISOString().slice(0, 10);

  // Find confirmed sorties in the next 24h-25h window (24h reminder)
  const sRes = await fetch(
    `${SUPA_URL}/rest/v1/groupes?select=id,film_id,confirmed_cinema,confirmed_heure,confirmed_date,nom&confirmed_date=eq.${today}&not.confirmed_heure=is.null`,
    { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } }
  );
  const sorties = await sRes.json() || [];

  let totalSent = 0;

  for (const sortie of sorties) {
    if (!sortie.confirmed_heure || !sortie.confirmed_date) continue;
    const [h, m] = sortie.confirmed_heure.replace('h', ':').split(':').map(Number);
    const sortieTime = new Date(`${sortie.confirmed_date}T${String(h).padStart(2,'0')}:${String(m||0).padStart(2,'0')}:00`);

    const diff = sortieTime - now;
    const is24h = diff > 23 * 3600 * 1000 && diff <= 25 * 3600 * 1000;
    const is1h  = diff > 30 * 60 * 1000  && diff <= 90 * 60 * 1000;

    if (!is24h && !is1h) continue;

    // Get members of this sortie
    const mRes = await fetch(
      `${SUPA_URL}/rest/v1/groupe_membres?select=user_id&groupe=eq.${sortie.id}`,
      { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } }
    );
    const members = await mRes.json() || [];
    const userIds = members.map(m => m.user_id).filter(Boolean);

    if (!userIds.length) continue;

    const timeLabel = is1h ? 'dans 1 heure' : 'demain';
    const body = `${sortie.nom || 'Ta sortie'} — ${sortie.confirmed_heure} ${timeLabel} 🍿`;

    // Send via push-send
    const pushRes = await fetch(`${process.env.VERCEL_URL || 'https://cinematch.vercel.app'}/api/push-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userIds,
        notification: {
          title: `Rappel séance ${is1h ? '⏰' : '📅'}`,
          body,
          tag: `reminder-${sortie.id}-${is1h ? '1h' : '24h'}`,
          url: `/?group=${sortie.id}`,
          urgency: is1h ? 'high' : 'normal',
        },
      }),
    });

    const result = await pushRes.json().catch(() => ({}));
    totalSent += result.sent || 0;
  }

  return res.json({ ok: true, sent: totalSent, checked: sorties.length });
}
