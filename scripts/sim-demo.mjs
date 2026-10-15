// Drives SteadyUp on the Vega Virtual Device for the demo recording, with a
// simulated phone. Keys go in through `vda shell inputd-cli`.
//   node scripts/sim-demo.mjs pair          # home -> pair screen (read the code off the screen)
//   node scripts/sim-demo.mjs run <code>    # phone joins, then the whole session
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../server/package.json', import.meta.url));
const WebSocket = require('ws');

const VDA = process.env.VDA ?? execFileSync(`${process.env.HOME}/vega/bin/vega`, ['which', 'vda']).toString().trim().split('\n').pop();
const SERVER = process.env.SERVER ?? 'https://steadyup.onrender.com';
const KEYS = { right: 'KEY_RIGHT', left: 'KEY_LEFT', up: 'KEY_UP', down: 'KEY_DOWN', ok: 'KEY_ENTER' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function raise() {
  try { execFileSync('osascript', ['-e', 'tell application "System Events" to set frontmost of (first process whose name is "vega-virtual-device") to true'], { stdio: 'ignore' }); } catch {}
}
async function press(k, after = 700) {
  raise();
  execFileSync(VDA, ['shell', `inputd-cli button_press ${KEYS[k]}`], { stdio: 'ignore' });
  await sleep(after);
}

const [mode, code] = process.argv.slice(2);

if (mode === 'pair') {
  await sleep(4000); // linger on home
  await press('right');
  await press('ok', 1500);
  process.exit(0);
}

if (mode !== 'run' || !/^\d{4}$/.test(code ?? '')) {
  console.error('usage: sim-demo.mjs pair | run <code>');
  process.exit(1);
}

const phone = new WebSocket(`${SERVER.replace(/^http/, 'ws')}/ws?code=${code}&role=phone`);
await new Promise((r, j) => { phone.on('open', r); phone.on('error', j); });
const send = (m) => phone.send(JSON.stringify(m));
let phoneMode = 'idle';
const holdScores = [91, 84, 72];
const pastStats = {
  sessions: 2, streak: 2, thisWeek: 2, steadinessFrom: 72, steadinessTo: 79,
  recent: [{ date: '2026-10-13', reps: 4, best: 72, exercises: 6 }, { date: '2026-10-14', reps: 5, best: 79, exercises: 6 }],
};
send({ type: 'history', stats: pastStats });
phone.on('message', (d) => {
  const m = JSON.parse(d);
  if (m.type === 'say') console.log('say:', m.text);
  if (m.type === 'coach') console.log('coach:', JSON.stringify(m));
  if (m.type === 'session_done') {
    send({ type: 'history', stats: { ...pastStats, sessions: 3, streak: 3, thisWeek: 3, steadinessTo: m.session.best, recent: [...pastStats.recent, { date: '2026-10-15', ...m.session }] } });
  }
  if (m.type === 'mode') {
    if (phoneMode === 'hold' && m.mode !== 'hold') {
      send({ type: 'event', event: { type: 'hold_end', steadiness: holdScores.shift() ?? 80, durationMs: 8500, meanRms: 0.07, perSecond: [] } });
    }
    phoneMode = m.mode;
  }
});
const tick = setInterval(() => {
  const steadiness = Math.round(80 + 10 * Math.sin(Date.now() / 700));
  send({ type: 'state', mode: phoneMode, reps: 0, standing: false, angle: 3, steadiness });
}, 200);

// Wait for the TV to switch the phone into a mode (or out of one).
const waitMode = (want) => new Promise((resolve) => {
  if (want(phoneMode)) return resolve();
  const t = setInterval(() => { if (want(phoneMode)) { clearInterval(t); resolve(); } }, 100);
});

await sleep(3000); // "Phone connected"
await press('ok', 1500); // Continue -> home
await press('left');
await press('ok', 4000); // Start today's session -> safety check
await press('ok', 4500); // All good -> warm-up intro
await press('ok', 33000); // warm-up runs 30 s
await press('ok', 5000); // Next -> sit to stand intro
await press('ok'); // start, countdown
await waitMode((m) => m === 'reps');
await sleep(1500);
for (let r = 1; r <= 5; r++) {
  send({ type: 'event', event: { type: 'rep', reps: r } });
  await sleep(2000);
}
await sleep(2500);
await press('ok', 5000); // Next -> heel raises intro
await press('ok', 5000); // start
await press('ok', 2500); // Done
await press('ok', 5000); // Next -> feet together intro
for (let i = 0; i < 3; i++) {
  await press('ok'); // start, countdown
  await waitMode((m) => m === 'hold');
  await waitMode((m) => m !== 'hold');
  await sleep(3000); // result
  await press('ok', 5000); // Next
}
await sleep(12000); // summary + AI coach
clearInterval(tick);
phone.close();
console.log('done');
