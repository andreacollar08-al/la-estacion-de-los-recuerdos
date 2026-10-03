'use strict';

// This repository is retired. Do not load the old database or payment services.
const http = require('node:http');
const RESERVATIONS_URL = 'https://rubielphoto.com';
const MESSAGE = 'La campaña anterior está suspendida. Las reservas actuales se realizan en https://rubielphoto.com.';

function createRetiredServer() {
  return http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const isApi = pathname === '/api' || pathname.startsWith('/api/');
    res.writeHead(410, {
      'Content-Type': isApi ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'X-Content-Type-Options': 'nosniff'
    });
    const body = isApi
      ? JSON.stringify({ success: false, code: 'CAMPAIGN_RETIRED', error: MESSAGE, reservations_url: RESERVATIONS_URL })
      : `${MESSAGE}\n`;
    // No redirect: the old server may still be behind rubielphoto.com.
    res.end(req.method === 'HEAD' ? undefined : body);
  });
}

if (require.main === module) {
  createRetiredServer().listen(process.env.PORT || 3000, () => {
    console.log('Campaña anterior suspendida: todas las rutas responden HTTP 410.');
  });
}

module.exports = { createRetiredServer };
