// SteadyUp server: pairing, live phone <-> TV relay, and the phone sensor page.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import QRCode from 'qrcode';
import { createSessionStore } from './sessions.js';
import { createCoach } from './coach.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const MAX_MESSAGE_BYTES = 4096;
const COACH_LIMIT = 20; // AI coach requests per client per window (Bedrock costs money)
const COACH_WINDOW_MS = 10 * 60 * 1000;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

function baseUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] ?? 'http';
  return `${proto}://${req.headers['x-forwarded-host'] ?? req.headers.host}`;
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  res.end(JSON.stringify(body));
}

async function sendFile(res, relPath) {
  const path = normalize(join(PUBLIC_DIR, relPath));
  if (!path.startsWith(PUBLIC_DIR)) return sendJson(res, 404, { error: 'not_found' });
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(body);
  } catch {
    sendJson(res, 404, { error: 'not_found' });
  }
}

async function readJson(req, maxBytes = MAX_MESSAGE_BYTES) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > maxBytes) throw new Error('too_large');
  }
  return JSON.parse(body || '{}');
}

export function createServer({ store = createSessionStore(), coach = createCoach() } = {}) {
  const coachUse = new Map(); // client ip -> { since, count }
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST',
        'access-control-allow-headers': 'content-type',
      });
      return res.end();
    }
    if (path === '/health') return sendJson(res, 200, { ok: true, sessions: store.size() });

    if (req.method === 'POST' && path === '/api/sessions') {
      const s = store.create();
      const phoneUrl = `${baseUrl(req)}/p/${s.code}`;
      const qrSvg = await QRCode.toString(phoneUrl, { type: 'svg', margin: 1 });
      return sendJson(res, 201, { code: s.code, phoneUrl, qrSvg });
    }
    // Personal coaching message for the session summary (Amazon Bedrock, see coach.js).
    if (req.method === 'POST' && path === '/api/coach') {
      let body;
      try {
        body = await readJson(req);
      } catch {
        return sendJson(res, 400, { error: 'bad_request' });
      }
      const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress).split(',')[0].trim();
      const now = Date.now();
      const use = coachUse.get(ip);
      if (!use || now - use.since > COACH_WINDOW_MS) coachUse.set(ip, { since: now, count: 1 });
      else if (++use.count > COACH_LIMIT) return sendJson(res, 429, { error: 'too_many_requests' });
      return sendJson(res, 200, await coach(body.results));
    }
    // PNG QR for TV apps that cannot render SVG.
    const qrMatch = path.match(/^\/api\/sessions\/(\d{4})\/qr\.png$/);
    if (req.method === 'GET' && qrMatch) {
      if (!store.get(qrMatch[1])) return sendJson(res, 404, { error: 'not_found' });
      const png = await QRCode.toBuffer(`${baseUrl(req)}/p/${qrMatch[1]}`, { type: 'png', width: 600, margin: 1 });
      res.writeHead(200, { 'content-type': 'image/png', 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
      return res.end(png);
    }
    const sessionMatch = path.match(/^\/api\/sessions\/(\d{4})$/);
    if (req.method === 'GET' && sessionMatch) {
      const s = store.get(sessionMatch[1]);
      if (!s) return sendJson(res, 404, { error: 'not_found' });
      return sendJson(res, 200, { code: s.code, tv: s.peers.tv.size, phones: s.peers.phone.size });
    }

    if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' });
    if (path === '/' ) return sendFile(res, 'tv.html');
    // The TV app built for the browser (scripts/build-web-app.sh), and a page that
    // shows it in a scaled 1920x1080 frame so it fits any window.
    if (path === '/app' || path === '/app/') return sendFile(res, 'app/index.html');
    if (path === '/play') return sendFile(res, 'play.html');
    if (/^\/p\/\d{4}$/.test(path)) return sendFile(res, 'phone.html');
    return sendFile(res, path.slice(1));
  });

  // WebSocket: /ws?code=1234&role=tv|phone. Messages are relayed to the other side.
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: MAX_MESSAGE_BYTES });
  wss.on('connection', (ws, req) => {
    const params = new URL(req.url, 'http://localhost').searchParams;
    const code = params.get('code');
    const role = params.get('role');
    if (!['tv', 'phone'].includes(role) || !store.join(code, role, ws)) {
      ws.close(4404, 'unknown session');
      return;
    }
    const announce = (connected) => {
      for (const peer of store.others(code, role)) {
        peer.send(JSON.stringify({ type: 'peer', role, connected }));
      }
    };
    announce(true);
    // Tell the newcomer whether the other side is already here.
    if (store.others(code, role).length > 0) {
      ws.send(JSON.stringify({ type: 'peer', role: role === 'tv' ? 'phone' : 'tv', connected: true }));
    }

    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      store.touch(code);
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (typeof msg?.type !== 'string') return;
      const out = JSON.stringify({ ...msg, from: role });
      for (const peer of store.others(code, role)) {
        if (peer.readyState === peer.OPEN) peer.send(out);
      }
    });
    ws.on('close', () => {
      store.leave(code, role, ws);
      announce(false);
    });
  });

  const sweeper = setInterval(() => {
    store.sweep();
    coachUse.clear(); // the coach rate-limit window is also 10 minutes
  }, COACH_WINDOW_MS);
  sweeper.unref();
  server.on('close', () => {
    clearInterval(sweeper);
    wss.close();
  });
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 8787);
  createServer().listen(port, () => {
    console.log(`SteadyUp server on http://localhost:${port}`);
    if (process.env.PUBLIC_URL) console.log(`Public URL: ${process.env.PUBLIC_URL}`);
  });
}
