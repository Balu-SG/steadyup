// Browser stand-in for the Fire TV app: pairing QR, controls, live readout.
const $ = (id) => document.getElementById(id);
const HOLD_MS = 10_000;
const COUNTDOWN_S = 3;

let ws = null;
let code = null;
let holdTimer = null;
let countdownTimer = null;

function log(text) {
  const line = document.createElement('div');
  line.textContent = `${new Date().toLocaleTimeString()}  ${text}`;
  $('log').prepend(line);
}

function send(msg) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function setMode(mode) {
  clearTimeout(holdTimer);
  clearInterval(countdownTimer);
  send({ type: 'mode', mode });
  $('mode').textContent = `Mode: ${mode}`;
  if (mode === 'reps') $('repCount').textContent = '0';
  if (mode === 'hold') holdTimer = setTimeout(() => setMode('idle'), HOLD_MS);
}

// Give the person time to get into position after pressing the button.
function startHoldWithCountdown() {
  clearTimeout(holdTimer);
  clearInterval(countdownTimer);
  let left = COUNTDOWN_S;
  $('mode').textContent = `Get ready… ${left}`;
  countdownTimer = setInterval(() => {
    left -= 1;
    if (left > 0) {
      $('mode').textContent = `Get ready… ${left}`;
    } else {
      clearInterval(countdownTimer);
      setMode('hold');
      $('mode').textContent = 'Mode: hold · stand still';
    }
  }, 1000);
}

function onMessage(msg) {
  if (msg.type === 'peer' && msg.role === 'phone') {
    $('peer').textContent = msg.connected ? 'Phone connected ✓' : 'Phone disconnected';
    $('peer').className = msg.connected ? 'ok' : 'bad';
    log(msg.connected ? 'Phone connected' : 'Phone disconnected');
  }
  if (msg.type === 'hello') log(`Phone ready · screen awake: ${msg.wakeLock ? 'yes' : 'NO, screen may turn off'}`);
  if (msg.type === 'wake') log(msg.wakeLock ? 'Phone screen kept awake' : 'Phone screen keep-awake lost');
  if (msg.type === 'state') {
    $('repCount').textContent = msg.reps;
    $('angle').textContent = `${msg.angle}°`;
    $('steady').textContent = msg.mode === 'hold' ? msg.steadiness : '–';
    $('meter').style.width = `${msg.steadiness}%`;
  }
  if (msg.type === 'event') {
    const ev = msg.event;
    if (ev.type === 'rep') log(`Rep ${ev.reps}`);
    if (ev.type === 'hold_end') {
      log(`Hold done: steadiness ${ev.steadiness} over ${(ev.durationMs / 1000).toFixed(1)} s · sway ${ev.meanRms} m/s² · per second [${ev.perSecond.join(', ')}]`);
    }
    if (ev.type === 'possible_fall') {
      $('alert').classList.add('on');
      log('Possible fall');
    }
  }
}

async function start() {
  const res = await fetch('/api/sessions', { method: 'POST' });
  const session = await res.json();
  code = session.code;
  $('qr').innerHTML = session.qrSvg;
  $('code').textContent = code;
  log(`Phone link: ${session.phoneUrl}`);

  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws?code=${code}&role=tv`);
  ws.onmessage = (e) => onMessage(JSON.parse(e.data));
  ws.onclose = () => log('Connection to server closed');
}

$('calibrate').onclick = () => { send({ type: 'calibrate' }); log('Calibrated (seated)'); };
$('reps').onclick = () => setMode('reps');
$('hold').onclick = () => startHoldWithCountdown();
$('stop').onclick = () => setMode('idle');
document.addEventListener('keydown', () => $('alert').classList.remove('on'));
$('alert').onclick = () => $('alert').classList.remove('on');

start();
