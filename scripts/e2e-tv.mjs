// End-to-end check of the TV app (web build) with a simulated phone.
// Drives headless Chrome over the DevTools protocol, presses remote keys,
// and takes screenshots. Usage:
//   node scripts/e2e-tv.mjs <tv-url> <server-url> <out-dir> <chrome-profile-dir>
// With E2E_RECORD=<dir> it also records video frames with captions; turn them
// into an MP4 with scripts/make-video.mjs.
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
  await caption(''); // a caption belongs to one screen only
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

// ---------- demo video recording (no-ops unless E2E_RECORD is set) ----------
const RECORD = process.env.E2E_RECORD;
const marks = []; // [{t, speed}]: playback speed from time t onwards
let recording = false;
async function startRecording() {
  if (!RECORD) return;
  mkdirSync(RECORD, { recursive: true });
  recording = true;
  speed(1);
  (async () => {
    while (recording) {
      const t = Date.now();
      const { result } = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
      writeFileSync(join(RECORD, `${t}.jpg`), Buffer.from(result.data, 'base64'));
    }
  })();
}
function stopRecording() {
  if (!RECORD) return;
  recording = false;
  speed(1);
  writeFileSync(join(RECORD, 'marks.json'), JSON.stringify(marks));
}
function speed(x) {
  if (RECORD) marks.push({ t: Date.now(), speed: x });
}
const linger = (ms) => (RECORD ? sleep(ms) : Promise.resolve());
// A caption pill in the bottom-right corner, clear of the app's own footer hint.
async function caption(text) {
  if (!RECORD) return;
  await evalJs(`(() => {
    let el = document.getElementById('demo-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-caption';
      Object.assign(el.style, { position: 'fixed', right: '96px', bottom: '22px', maxWidth: '1100px', padding: '14px 32px',
        borderRadius: '999px', background: '#F2B544', color: '#1C1C1C', font: '700 30px system-ui, sans-serif', zIndex: 99999 });
      document.body.appendChild(el);
    }
    el.textContent = ${JSON.stringify(text)};
    el.style.display = ${JSON.stringify(text)} ? 'block' : 'none';
  })()`);
}
// A full-screen title card over the app.
async function titleCard(sub) {
  if (!RECORD) return;
  await evalJs(`(() => {
    const el = document.createElement('div');
    el.id = 'demo-title';
    Object.assign(el.style, { position: 'fixed', inset: '0', background: '#0B2A2B', color: '#F4F1E8', zIndex: 100000,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', font: '800 120px system-ui, sans-serif' });
    el.innerHTML = '<div><span style="color:#F2B544">Steady</span>Up</div><div style="font:500 44px system-ui, sans-serif;color:#A9C4C1;margin-top:28px;max-width:1300px;text-align:center;line-height:1.35"></div>';
    el.lastChild.textContent = ${JSON.stringify(sub)};
    document.body.appendChild(el);
  })()`);
  await sleep(4000);
  await evalJs(`document.getElementById('demo-title')?.remove()`);
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
    if (el.id === 'demo-caption') continue;
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
// Always load the latest build: a cached bundle may point at an old tunnel URL.
await cdp('Network.enable');
await cdp('Network.clearBrowserCache');
await cdp('Network.setCacheDisabled', { cacheDisabled: true });
await cdp('Page.navigate', { url: tvUrl });
await sleep(4000);
await startRecording();
await titleCard('Strength and balance exercises on your TV. The phone in your pocket does the counting.');
await caption("Today's 5-minute session, driven by the TV remote");
await screenshot('home');
await linger(3000);

// Pair: Right -> "Pair phone", OK.
await press('ArrowRight');
await press('Enter');
await sleep(1500);
await caption('Scan the code with any phone. No app to install');
await screenshot('pair');
await linger(3000);
const code = (await bodyText()).match(/\b(\d{4})\b/)?.[1];
console.log('pairing code on TV:', code);
if (!code) {
  chrome.kill();
  throw new Error('No pairing code on the TV. Is the server reachable at the URL in config.ts?');
}

// Simulated phone joins and follows TV commands.
const phone = new WebSocket(`${serverUrl.replace(/^http/, 'ws')}/ws?code=${code}&role=phone`);
await new Promise((r) => phone.on('open', r));
let mode = 'idle';
const holdScores = [91, 84, 72];
const send = (m) => phone.send(JSON.stringify(m));
phone.on('message', (d) => {
  const m = JSON.parse(d);
  if (m.type === 'mode') {
    if (mode === 'hold' && m.mode !== 'hold') {
      send({ type: 'event', event: { type: 'hold_end', steadiness: holdScores.shift() ?? 80, durationMs: 8500, meanRms: 0.07, perSecond: [] } });
    }
    mode = m.mode;
  }
});
// Live steadiness drifts a little, like a real person holding a stance.
const tick = setInterval(() => {
  const steadiness = Math.round(80 + 10 * Math.sin(Date.now() / 700));
  send({ type: 'state', mode, reps: 0, standing: false, angle: 3, steadiness });
}, 200);
await sleep(1500);
await caption('Phone connected');
await screenshot('paired');
await linger(2000);

// Back home, start the session.
await press('Enter'); // "Continue" (no next) -> back
await sleep(800);
await press('ArrowLeft');
await press('Enter'); // Start today's session -> Safety
await sleep(800);
await caption('A quick safety check before every session');
await screenshot('safety');
await linger(3500);
await press('Enter'); // All good, start
await sleep(800);
await caption('Every exercise has an animated demo and simple tips');
await screenshot('warmup-ready');
await demoFrames('warmup');
await linger(3500);

// Step 1 warm-up (timed 30 s).
await press('Enter');
await sleep(2000);
await caption('30-second warm-up (sped up)');
await screenshot('warmup-active');
speed(8);
await sleep(29000);
speed(1);
await caption('');
await screenshot('warmup-result');
await linger(1000);
await press('Enter'); // Next

// Step 2 sit-to-stand: OK, countdown, then the phone reports 5 reps.
await demoFrames('sit-to-stand');
await caption('Sit to stand: the phone in the pocket feels each stand');
await linger(3500);
await press('Enter');
await sleep(3800);
await caption('Each rep is counted from the thigh angle, hands-free');
for (let r = 1; r <= 5; r++) {
  send({ type: 'event', event: { type: 'rep', reps: r } });
  await sleep(RECORD ? 1800 : 500);
  if (r === 3) await screenshot('reps-counting');
}
await sleep(800);
await caption('');
await screenshot('reps-result');
await linger(1500);
await press('Enter'); // Next

// Step 3 heel raises: OK, Done.
await demoFrames('heel-raises');
await caption('Self-paced moves: press Done on the remote');
await press('Enter');
await linger(4000);
await press('Enter');
await screenshot('heels-result');
await linger(1000);
await press('Enter');

// Steps 4-6 holds.
for (const name of ['feet-together', 'semi-tandem', 'tandem']) {
  await demoFrames(name);
  if (name === 'feet-together') {
    await caption('Balance holds: live steadiness from how much the body sways');
    await linger(3000);
  }
  await press('Enter');
  if (name !== 'feet-together') speed(3);
  await sleep(3800 + 5000);
  if (name === 'feet-together') await screenshot('hold-active');
  await sleep(6500);
  speed(1);
  await screenshot(`${name}-result`);
  await linger(1000);
  await press('Enter');
}
await sleep(1000);
await caption('Session summary: reps done and best steadiness');
await screenshot('summary');
await linger(4500);
await titleCard('Fire TV · Vega OS · Android TV  +  any phone browser');
stopRecording();
console.log('--- summary text ---\n' + (await bodyText()));

console.log(layoutProblems.length ? `--- ${layoutProblems.length} layout problem(s) ---\n${layoutProblems.join('\n')}` : '--- layout OK on every screen ---');
if (layoutProblems.length) process.exitCode = 1;

clearInterval(tick);
phone.close();
ws.close();
chrome.kill();
