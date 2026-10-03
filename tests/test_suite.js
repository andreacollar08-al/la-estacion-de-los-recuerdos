'use strict';

const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createRetiredServer } = require('../server');

async function runTests() {
  const server = createRetiredServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const path of ['/', '/index.html', '/gracias.html', '/recibo.html?folio=TEST', '/admin', '/admin.html', '/js/app.js', '/assets/images/og_preview.jpg']) {
      const response = await fetch(`${origin}${path}`, { redirect: 'manual' });
      assert.equal(response.status, 410, path);
      assert.equal(response.headers.get('location'), null, 'Never redirect to the same origin');
      assert.match(response.headers.get('x-robots-tag'), /noindex/);
      assert.match(response.headers.get('cache-control'), /no-store/);
      const body = await response.text();
      assert.match(body, /campaña anterior está suspendida/);
      assert.doesNotMatch(body, /<form|<script|Acceso VIP/);
    }
    for (const [method, path] of [
      ['GET', '/api/config'], ['GET', '/api/availability'],
      ['POST', '/api/leads'], ['POST', '/api/lock-slot'],
      ['POST', '/api/release-slot'], ['POST', '/api/create-reservation'],
      ['POST', '/api/demo-checkout'], ['POST', '/api/webhook/mercadopago'],
      ['POST', '/api/admin/login'], ['DELETE', '/api/admin/leads/1'],
      ['GET', '/api/reservation-by-folio/TEST?confirm_simulated=1']
    ]) {
      const response = await fetch(`${origin}${path}`, {
        method,
        ...(method === 'POST' ? { body: '{invalid json', headers: { 'Content-Type': 'application/json' } } : {})
      });
      assert.equal(response.status, 410, `${method} ${path}`);
      const data = await response.json();
      assert.equal(data.success, false);
      assert.equal(data.code, 'CAMPAIGN_RETIRED');
      assert.equal(data.reservations_url, 'https://rubielphoto.com');
    }
    const head = await fetch(origin, { method: 'HEAD' });
    assert.equal(head.status, 410);
    assert.equal(await head.text(), '');
    console.log('OK: landing, archivos y API antiguos suspendidos; sin redirecciones ni nuevos registros.');
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

runTests().catch(error => { console.error(error); process.exitCode = 1; });
