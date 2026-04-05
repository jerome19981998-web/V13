const fs = require('fs');
const path = require('path');

module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Service-Worker-Allowed', '/');

  try {
    const swPath = path.join(process.cwd(), 'sw.js');
    const content = fs.readFileSync(swPath, 'utf8');
    res.status(200).send(content);
  } catch(e) {
    console.error('sw.js not found:', e.message);
    res.status(404).send('// sw.js not found');
  }
}
