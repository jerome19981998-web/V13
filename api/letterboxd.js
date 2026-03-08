export default async function handler(req, res) {
  const { pseudo } = req.query;

  if (!pseudo || !/^[a-zA-Z0-9_-]+$/.test(pseudo)) {
    return res.status(400).json({ error: 'Pseudo invalide' });
  }

  try {
    const rssUrl = `https://letterboxd.com/${pseudo}/rss/`;
    const r = await fetch(rssUrl, {
      headers: { 'User-Agent': 'CineMatch/1.0' },
      signal: AbortSignal.timeout(8000),
    });

    if (!r.ok) {
      return res.status(404).json({ error: 'Profil introuvable ou privé' });
    }

    const xml = await r.text();

    // Parser les items RSS
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];
      const title     = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                         block.match(/<title>(.*?)<\/title>/))?.[1] || '';
      const cats      = [...block.matchAll(/<category><!\[CDATA\[(.*?)\]\]><\/category>/g)]
                          .map(m => m[1].toLowerCase());
      const letterboxdUri = (block.match(/<letterboxd:filmTitle>(.*?)<\/letterboxd:filmTitle>/))?.[1]
                         || title.replace(/,\s*\d{4}$/, '').replace(/^.*?:\s*/, '');

      items.push({ title: letterboxdUri.trim(), cats });
    }

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ items });

  } catch (e) {
    return res.status(500).json({ error: 'Erreur serveur', detail: e.message });
  }
}
