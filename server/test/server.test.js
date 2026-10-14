import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createServer } from '../src/index.js';
import { createSessionStore, SESSION_TTL_MS } from '../src/sessions.js';

async function start() {
  const server = createServer();
  server.listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  return { server, base: `http://localhost:${port}`, ws: `ws://localhost:${port}/ws` };
}

function nextMessage(ws) {
  return once(ws, 'message').then(([data]) => JSON.parse(data.toString()));
}

test('creates a session with a 4-digit code, phone URL and QR', async () => {
  const { server, base } = await start();
  const res = await fetch(`${base}/api/sessions`, { method: 'POST' });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.match(body.code, /^\d{4}$/);
  assert.equal(body.phoneUrl, `${base}/p/${body.code}`);
  assert.match(body.qrSvg, /^<svg/);
  server.close();
});

test('serves a PNG QR code for an existing session only', async () => {
  const { server, base } = await start();
  const { code } = await (await fetch(`${base}/api/sessions`, { method: 'POST' })).json();
  const res = await fetch(`${base}/api/sessions/${code}/qr.png`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  const bytes = new Uint8Array(await res.arrayBuffer());
  assert.deepEqual([...bytes.slice(1, 4)], [0x50, 0x4e, 0x47]); // "PNG"
  assert.equal((await fetch(`${base}/api/sessions/9999/qr.png`)).status, 404);
  server.close();
});

test('relays phone messages to the TV and announces the peer', async () => {
  const { server, base, ws } = await start();
  const { code } = await (await fetch(`${base}/api/sessions`, { method: 'POST' })).json();

  const tv = new WebSocket(`${ws}?code=${code}&role=tv`);
  await once(tv, 'open');
  const peerMsg = nextMessage(tv);
  const phone = new WebSocket(`${ws}?code=${code}&role=phone`);
  await once(phone, 'open');
  assert.deepEqual(await peerMsg, { type: 'peer', role: 'phone', connected: true });

  const stateMsg = nextMessage(tv);
  phone.send(JSON.stringify({ type: 'state', reps: 3 }));
  assert.deepEqual(await stateMsg, { type: 'state', reps: 3, from: 'phone' });

  const cmd = nextMessage(phone);
  tv.send(JSON.stringify({ type: 'mode', mode: 'hold' }));
  assert.deepEqual(await cmd, { type: 'mode', mode: 'hold', from: 'tv' });

  tv.close();
  phone.close();
  server.close();
});

test('rejects unknown session codes', async () => {
  const { server, ws } = await start();
  const sock = new WebSocket(`${ws}?code=0000&role=phone`);
  const [code] = await once(sock, 'close');
  assert.equal(code, 4404);
  server.close();
});

test('serves the phone page for /p/<code>', async () => {
  const { server, base } = await start();
  const res = await fetch(`${base}/p/1234`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /SteadyUp/);
  server.close();
});

test('sweep removes idle empty sessions only', () => {
  let t = 0;
  const store = createSessionStore({ now: () => t });
  const idle = store.create();
  const busy = store.create();
  store.join(busy.code, 'tv', {});
  t = SESSION_TTL_MS + 1;
  store.sweep();
  assert.equal(store.get(idle.code), null);
  assert.ok(store.get(busy.code));
});
