// End-to-end check of the TV app (web build) with a simulated phone.
// Drives headless Chrome over the DevTools protocol, presses remote keys,
// and takes screenshots. Usage:
//   node scripts/e2e-tv.mjs <tv-url> <server-url> <out-dir>
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../server/package.json', import.meta.url));
const WebSocket = require('ws');

const [tvUrl, serverUrl, outDir, profileDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=1920,1080',
  '--remote-debugging-port=9333', `--user-data-dir=${profileDir}`, 'about:blank',
], { stdio: 'ignore' });

async function cdpTarget() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch('http://127.0.0.1:9333/json')).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error('Chrome did not start');
}

const ws = new WebSocket(await cdpTarget());
await new Promise((r) => ws.on('open', r));
let id = 0;
const pending = new Map();
ws.on('message', (d) => {
  const m = JSON.parse(d);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
});
const cdp = (method, params = {}) =>
  new Promise((r) => {
    const n = ++id;
    pending.set(n, r);
    ws.send(JSON.stringify({ id: n, method, params }));
  });

const KEYS = { Enter: 13, ArrowRight: 39, ArrowLeft: 37, ArrowDown: 40, ArrowUp: 38 };
async function press(key) {
  for (const type of ['keyDown', 'keyUp']) {
    await cdp('Input.dispatchKeyEvent', { type, key, code: key, windowsVirtualKeyCode: KEYS[key] });
  }
  await sleep(400);
}
let shot = 0;
async function screenshot(name) {
  const { result } = await cdp('Page.captureScreenshot', { format: 'png' });
  const file = join(outDir, `${String(++shot).padStart(2, '0')}-${name}.png`);
  writeFileSync(file, Buffer.from(result.data, 'base64'));
  console.log('screenshot', file);
  const problems = await evalJs(LAYOUT_CHECK);
  if (problems.length) {
    layoutProblems.push(...problems.map((p) => `${name}: ${p}`));
    console.log('  LAYOUT:', problems.join('; '));
  }
}

// With E2E_DEMO_FRAMES=1, grab a strip of frames from the exercise demo animation.
async function demoFrames(name) {
  if (!process.env.E2E_DEMO_FRAMES) return;
  const dir = join(outDir, 'demo');
  mkdirSync(dir, { recursive: true });
  for (let f = 0; f < 8; f++) {
    const { result } = await cdp('Page.captureScreenshot', { format: 'png', clip: { x: 1110, y: 200, width: 700, height: 400, scale: 0.5 } });
    writeFileSync(join(dir, `${name}-${f}.png`), Buffer.from(result.data, 'base64'));
    await sleep(500);
  }
}

// Flags anything that runs off the bottom of the screen or into the footer hint
// ("OK select ..."), which every screen draws last.
const layoutProblems = [];
const LAYOUT_CHECK = `(() => {
  const out = [];
  const H = innerHeight;
  const all = [...document.querySelectorAll('div')].filter((el) => el.offsetParent !== null);
  const leaves = all.filter((el) => el.children.length === 0 && el.innerText.trim());
  const hint = leaves.filter((el) => /select/.test(el.innerText)).pop();
  // Measure the hint's glyphs, not its padded box.
  let hr = null;
  if (hint) { const range = document.createRange(); range.selectNodeContents(hint); hr = range.getBoundingClientRect(); }
  for (const el of all) {
    if (hint && (el === hint || el.contains(hint) || hint.contains(el))) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.width >= innerWidth && r.height >= H - 1) continue; // full-screen containers
    const label = (el.innerText || '').trim().split('\\n')[0].slice(0, 40) || '(box)';
    if (r.bottom > H + 1 && r.top < H) out.push('cut off at bottom: ' + label);
    else if (r.top >= H) out.push('off screen: ' + label);
    else if (hr && r.bottom > hr.top + 1 && r.top < hr.bottom && r.right > hr.left && r.left < hr.right) out.push('overlaps hint by ' + Math.round(r.bottom - hr.top) + 'px: ' + label);
  }
  return [...new Set(out)];
})()`;
const evalJs = async (expr) => (await cdp('Runtime.evaluate', { expression: expr, returnByValue: true })).result.result.value;
const bodyText = () => evalJs('document.body.innerText');

await cdp('Page.enable');
// --window-size includes browser chrome; force a true 1080p TV viewport.
await cdp('Emulation.setDeviceMetricsOverride', { width: 1920, height: Number(process.env.E2E_HEIGHT ?? 1080), deviceScaleFactor: 1, mobile: false });
await cdp('Runtime.enable');
await cdp('Page.navigate', { url: tvUrl });
await sleep(4000);
await screenshot('home');

// Pair: Right -> "Pair phone", OK.
await press('ArrowRight');
await press('Enter');
await sleep(1500);
await screenshot('pair');
const code = (await bodyText()).match(/\b(\d{4})\b/)?.[1];
console.log('pairing code on TV:', code);

// Simulated phone joins and follows TV commands.
const phone = new WebSocket(`${serverUrl.replace(/^http/, 'ws')}/ws?code=${code}&role=phone`);
await new Promise((r) => phone.on('open', r));
let mode = 'idle';
const send = (m) => phone.send(JSON.stringify(m));
phone.on('message', (d) => {
  const m = JSON.parse(d);
  if (m.type === 'mode') {
    if (mode === 'hold' && m.mode !== 'hold') {
      send({ type: 'event', event: { type: 'hold_end', steadiness: 82, durationMs: 8500, meanRms: 0.07, perSecond: [] } });
    }
    mode = m.mode;
  }
});
const tick = setInterval(() => send({ type: 'state', mode, reps: 0, standing: false, angle: 3, steadiness: 84 }), 200);
await sleep(1500);
await screenshot('paired');

// Back home, start the session.
await press('Enter'); // "Continue" (no next) -> back
await sleep(800);
await press('ArrowLeft');
await press('Enter'); // Start today's session -> Safety
await sleep(800);
await screenshot('safety');
await press('Enter'); // All good, start
await sleep(800);
await screenshot('warmup-ready');
await demoFrames('warmup');

// Step 1 warm-up (timed 30 s).
await press('Enter');
await sleep(2000);
await screenshot('warmup-active');
await sleep(29000);
await screenshot('warmup-result');
await press('Enter'); // Next

// Step 2 sit-to-stand: OK, countdown, then the phone reports 5 reps.
await demoFrames('sit-to-stand');
await press('Enter');
await sleep(3800);
for (let r = 1; r <= 5; r++) {
  send({ type: 'event', event: { type: 'rep', reps: r } });
  await sleep(500);
  if (r === 3) await screenshot('reps-counting');
}
await sleep(800);
await screenshot('reps-result');
await press('Enter'); // Next

// Step 3 heel raises: OK, Done.
await demoFrames('heel-raises');
await press('Enter');
await press('Enter');
await screenshot('heels-result');
await press('Enter');

// Steps 4-6 holds.
for (const name of ['feet-together', 'semi-tandem', 'tandem']) {
  await demoFrames(name);
  await press('Enter');
  await sleep(3800 + 5000);
  if (name === 'feet-together') await screenshot('hold-active');
  await sleep(6500);
  await screenshot(`${name}-result`);
  await press('Enter');
}
await sleep(1000);
await screenshot('summary');
console.log('--- summary text ---\n' + (await bodyText()));

console.log(layoutProblems.length ? `--- ${layoutProblems.length} layout problem(s) ---\n${layoutProblems.join('\n')}` : '--- layout OK on every screen ---');

clearInterval(tick);
phone.close();
ws.close();
chrome.kill();
