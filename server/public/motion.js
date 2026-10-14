// SteadyUp motion processing. Runs on the phone (browser) and in Node tests.
// Input: devicemotion samples with gravity included (m/s^2). The phone sits in
// a front trouser pocket, so thigh angle tells sitting (~0°) from standing (~90°).

export const G = 9.81;

export const DEFAULTS = {
  gravityAlpha: 0.1,      // low-pass factor for the gravity estimate (~60 Hz input)
  standDeg: 60,           // thigh angle that counts as "standing"
  sitDeg: 30,             // thigh angle that counts as "seated" again
  minRepMs: 800,          // reject reps faster than this (jitter, phone shifting)
  swayWindowMs: 1000,     // RMS window for the steadiness meter
  swayScale: 0.35,        // m/s^2; steadiness = 100 * exp(-rms / swayScale)
  holdSettleMs: 1500,     // ignore the first moments of a hold while the person settles
  fallPeak: 2.5 * G,      // impact threshold for a possible fall
  fallStillMs: 2000,      // stillness after impact before raising the prompt
  fallStillRms: 0.3,      // m/s^2; "still" below this
};

const norm = (v) => Math.hypot(v[0], v[1], v[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function angleBetween(a, b) {
  const n = norm(a) * norm(b);
  if (n === 0) return 0;
  return (Math.acos(Math.min(1, Math.max(-1, dot(a, b) / n))) * 180) / Math.PI;
}

// Sway = spread of the acceleration around its own mean (RMS). Unlike
// "acceleration minus filtered gravity", this is not thrown off by movement just
// before the window starts.
function createSpread() {
  return { n: 0, s: [0, 0, 0], ss: 0 };
}
function addToSpread(acc, a) {
  acc.n += 1;
  acc.s[0] += a[0];
  acc.s[1] += a[1];
  acc.s[2] += a[2];
  acc.ss += dot(a, a);
}
function spreadRms(acc) {
  if (acc.n === 0) return 0;
  const m = acc.s.map((v) => v / acc.n);
  return Math.sqrt(Math.max(0, acc.ss / acc.n - dot(m, m)));
}

export function steadinessFromRms(rms, scale = DEFAULTS.swayScale) {
  return Math.round(100 * Math.exp(-rms / scale));
}

export function createMotionTracker(options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  let gravity = null;
  let seatedRef = null;
  let mode = 'idle';
  let reps = 0;
  let standing = false;
  let lastRepAt = -Infinity;
  let window = [];           // [{t, a}] recent samples for the live sway meter
  let hold = null;           // {start, all, seconds} while mode === 'hold'
  let impactAt = null;
  let lastT = 0;
  const events = [];

  function swayRms() {
    const acc = createSpread();
    for (const w of window) addToSpread(acc, w.a);
    return spreadRms(acc);
  }

  function push({ t, ax, ay, az }) {
    lastT = t;
    const a = [ax, ay, az];
    gravity = gravity
      ? gravity.map((g, i) => g + cfg.gravityAlpha * (a[i] - g))
      : a.slice();
    if (!seatedRef) seatedRef = gravity.slice();

    window.push({ t, a });
    while (window.length && t - window[0].t > cfg.swayWindowMs) window.shift();
    const rms = swayRms();

    if (mode === 'reps') {
      const angle = angleBetween(gravity, seatedRef);
      if (!standing && angle >= cfg.standDeg) {
        standing = true;
      } else if (standing && angle <= cfg.sitDeg) {
        standing = false;
        if (t - lastRepAt >= cfg.minRepMs) {
          reps += 1;
          lastRepAt = t;
          events.push({ type: 'rep', t, reps });
        }
      }
    }

    if (mode === 'hold' && hold && t - hold.start >= cfg.holdSettleMs) {
      // Only samples after settling count, so walking into position is not "wobble".
      addToSpread(hold.all, a);
      // Per-second sway of the hold, for tuning and the progress chart.
      const second = Math.floor((t - hold.start - cfg.holdSettleMs) / 1000);
      hold.seconds[second] ??= createSpread();
      addToSpread(hold.seconds[second], a);
    }

    if (norm(a) >= cfg.fallPeak) {
      impactAt = t;
    } else if (impactAt !== null && t - impactAt >= cfg.fallStillMs) {
      if (rms < cfg.fallStillRms) events.push({ type: 'possible_fall', t });
      impactAt = null;
    }
  }

  return {
    push,
    // Call while the person is seated: the current gravity becomes "sitting".
    calibrate() {
      if (gravity) seatedRef = gravity.slice();
    },
    setMode(next) {
      if (mode === 'hold' && next !== 'hold' && hold) {
        events.push({ type: 'hold_end', t: lastT, ...this.holdSummary() });
      }
      mode = next;
      if (next === 'reps') {
        reps = 0;
        standing = false;
        lastRepAt = -Infinity;
      }
      hold = next === 'hold' ? { start: lastT, all: createSpread(), seconds: [] } : null;
    },
    holdSummary() {
      if (!hold || hold.all.n === 0) return { durationMs: 0, meanRms: 0, steadiness: 100, perSecond: [] };
      const meanRms = spreadRms(hold.all);
      return {
        durationMs: Math.max(0, lastT - hold.start - cfg.holdSettleMs),
        meanRms: Number(meanRms.toFixed(3)),
        steadiness: steadinessFromRms(meanRms, cfg.swayScale),
        perSecond: hold.seconds.filter(Boolean).map((s) => Number(spreadRms(s).toFixed(3))),
      };
    },
    state() {
      const rms = swayRms();
      return {
        mode,
        reps,
        standing,
        angle: gravity && seatedRef ? Math.round(angleBetween(gravity, seatedRef)) : 0,
        swayRms: rms,
        steadiness: steadinessFromRms(rms, cfg.swayScale),
      };
    },
    // Events since the last call (rep, hold_end, possible_fall).
    drainEvents() {
      return events.splice(0, events.length);
    },
  };
}
