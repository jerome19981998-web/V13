export default async function handler(req, res) {
  const { pseudo } = req.query;

  if (!pseudo || !/^[a-zA-Z0-9_-]+$/.test(pseudo)) {
    return res.status(400).json({ error: 'Pseudo invalide' });
  }

  try {
    // Récupérer le diary (films vus) ET la watchlist
    const [diaryRes, watchlistRes] = await Promise.allSettled([
      fetch(`https://letterboxd.com/${pseudo}/rss/`, {
        headers: { 'User-Agent': 'Mozilla/5.0 CineMatch/1.0' },
        signal: AbortSignal.timeout(8000),
      }),
      fetch(`https://letterboxd.com/${pseudo}/watchlist/rss/`, {
        headers: { 'User-Agent': 'Mozilla/5.0 CineMatch/1.0' },
        signal: AbortSignal.timeout(8000),
      }),
    ]);

    const items = [];

    // Parser diary = films vus
    if (diaryRes.status === 'fulfilled' && diaryRes.value.ok) {
      const xml = await diaryRes.value.text();
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      while ((match = itemRegex.exec(xml)) !== null) {
        const block = match[1];
        // Préférer le tag letterboxd:filmTitle s'il existe
        const filmTitle = (block.match(/<letterboxd:filmTitle>(.*?)<\/letterboxd:filmTitle>/))?.[1]
                       || (block.match(/<title><!\[CDATA\[(.*?)(?:,\s*\d{4})?\]\]><\/title>/))?.[1]
                       || (block.match(/<title>(.*?)(?:,\s*\d{4})?<\/title>/))?.[1]
                       || '';
        if (filmTitle) items.push({ title: filmTitle.trim(), cats: ['watched'] });
      }
    } else if (!diaryRes.status === 'fulfilled') {
      return res.status(404).json({ error: 'Profil introuvable ou privé' });
    }

    // Parser watchlist
    if (watchlistRes.status === 'fulfilled' && watchlistRes.value.ok) {
      const xml = await watchlistRes.value.text();
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      while ((match = itemRegex.exec(xml)) !== null) {
        const block = match[1];
        const filmTitle = (block.match(/<letterboxd:filmTitle>(.*?)<\/letterboxd:filmTitle>/))?.[1]
                       || (block.match(/<title><!\[CDATA\[(.*?)(?:,\s*\d{4})?\]\]><\/title>/))?.[1]
                       || '';
        if (filmTitle) items.push({ title: filmTitle.trim(), cats: ['wishlist'] });
      }
    }

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ items });

  } catch (e) {
    return res.status(500).json({ error: 'Erreur serveur', detail: e.message });
  }
}
