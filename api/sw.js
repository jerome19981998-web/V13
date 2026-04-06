const fs = require('fs');
const path = require('path');

module.exports = function handler(req, res) {
  // Serve sw.js with correct headers for Service Worker
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  try {
    const swPath = path.join(process.cwd(), 'sw.js');
    const content = fs.readFileSync(swPath, 'utf8');
    res.status(200).send(content);
  } catch(e) {
    // sw.js not found - return minimal valid SW
    res.status(200).send('// CinéMatch SW - file not found\nself.addEventListener("install",()=>self.skipWaiting());\nself.addEventListener("activate",()=>self.clients.claim());');
  }
};
