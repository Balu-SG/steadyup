// Phone sensor page: devicemotion -> motion tracker -> WebSocket to the TV.
import { createMotionTracker } from '/motion.js';

const SEND_EVERY_MS = 100; // 10 updates per second
const code = location.pathname.split('/').pop();
const $ = (id) => document.getElementById(id);

const tracker = createMotionTracker();
let ws = null;
let wakeLock = null;
let lastSent = 0;
let started = false;

function setStatus(text, kind = '') {
  $('status').textContent = text;
  $('status').className = kind;
}

function send(msg) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

// Spoken coaching sent by the TV ("Stand up", rep counts, ...).
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel(); // never queue up stale cues
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95;
  speechSynthesis.speak(u);
}

function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws?code=${code}&role=phone`);
  ws.onopen = () => setStatus(`Connected to TV · code ${code}`, 'ok');
  ws.onclose = (e) => {
    if (e.code === 4404) return setStatus('This code has expired. Scan the TV again.', 'bad');
    setStatus('Reconnecting…', 'bad');
    setTimeout(connect, 1500);
  };
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'mode') tracker.setMode(msg.mode);
    if (msg.type === 'calibrate') tracker.calibrate();
    if (msg.type === 'say' && started && typeof msg.text === 'string') speak(msg.text.slice(0, 300));
    if (msg.type === 'mode' || msg.type === 'calibrate') navigator.vibrate?.(60);
  };
}

function onMotion(e) {
  const a = e.accelerationIncludingGravity;
  if (a?.x == null) return;
  tracker.push({ t: e.timeStamp, ax: a.x, ay: a.y, az: a.z });

  for (const ev of tracker.drainEvents()) {
    send({ type: 'event', event: ev });
    if (ev.type === 'rep') navigator.vibrate?.(40);
  }
  if (e.timeStamp - lastSent >= SEND_EVERY_MS) {
    lastSent = e.timeStamp;
    const s = tracker.state();
    send({ type: 'state', ...s, interval: e.interval });
    $('reps').textContent = s.mode === 'hold' ? s.steadiness : s.reps;
    $('detail').textContent = s.mode === 'hold' ? 'steadiness' : `reps · thigh ${s.angle}°`;
  }
}

async function keepAwake() {
  try {
    wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
  } catch {
    wakeLock = null; // Not supported or denied (for example battery saver).
  }
  wakeLock?.addEventListener('release', () => {
    send({ type: 'wake', wakeLock: false });
    showWake(false);
  });
  showWake(Boolean(wakeLock));
  send({ type: 'wake', wakeLock: Boolean(wakeLock) });
  return Boolean(wakeLock);
}

function showWake(ok) {
  $('wake').textContent = ok
    ? 'Screen will stay on ✓'
    : 'Screen may turn off. Set screen timeout to 10 minutes, or turn off battery saver.';
  $('wake').className = ok ? 'ok' : 'bad';
}

$('start').addEventListener('click', async () => {
  if (started) return;
  if (!window.isSecureContext) {
    setStatus('Motion sensors need an https:// link. Ask the TV for a new code.', 'bad');
    return;
  }
  // iOS asks for permission, and only from a tap.
  if (typeof DeviceMotionEvent?.requestPermission === 'function') {
    const answer = await DeviceMotionEvent.requestPermission().catch(() => 'denied');
    if (answer !== 'granted') {
      setStatus('Motion access was not allowed. Reload and tap Allow.', 'bad');
      return;
    }
  }
  started = true;
  speak('Ready. Put me in your pocket.'); // iOS only allows speech after a tap; this unlocks it
  window.addEventListener('devicemotion', onMotion);
  const awake = await keepAwake();
  $('start').disabled = true;
  $('start').textContent = 'Running';
  $('intro').textContent = 'All set. Put the phone in your pocket and follow the TV.';
  $('live').classList.add('on');
  send({ type: 'hello', ua: navigator.userAgent, wakeLock: awake });
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && started) keepAwake();
});

connect();
