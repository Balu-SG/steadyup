import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMotionTracker, angleBetween, G, DEFAULTS } from '../public/motion.js';

const HZ = 60;
const DT = 1000 / HZ;

// Thigh angle 0° (seated: gravity along z) to 90° (standing: gravity along y).
function gravityAt(deg) {
  const r = (deg * Math.PI) / 180;
  return [0, G * Math.sin(r), G * Math.cos(r)];
}

// Seeded noise so tests are deterministic.
function noise(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s / 2147483647) * 2 - 1;
  };
}

function feed(tracker, samples, startT = 0) {
  let t = startT;
  for (const [ax, ay, az] of samples) {
    tracker.push({ t, ax, ay, az });
    t += DT;
  }
  return t;
}

function hold(deg, ms, jitter = 0, rnd = noise()) {
  const g = gravityAt(deg);
  return Array.from({ length: Math.round(ms / DT) }, () =>
    g.map((v) => v + jitter * rnd()),
  );
}

function ramp(fromDeg, toDeg, ms) {
  const n = Math.round(ms / DT);
  return Array.from({ length: n }, (_, i) => gravityAt(fromDeg + ((toDeg - fromDeg) * i) / (n - 1)));
}

function sitToStand(times, { upMs = 900, standMs = 600, downMs = 900, sitMs = 600 } = {}) {
  const out = [];
  for (let i = 0; i < times; i++) {
    out.push(...ramp(0, 90, upMs), ...hold(90, standMs), ...ramp(90, 0, downMs), ...hold(0, sitMs));
  }
  return out;
}

test('angleBetween: perpendicular and parallel vectors', () => {
  assert.equal(Math.round(angleBetween([0, 0, 1], [0, 1, 0])), 90);
  assert.equal(Math.round(angleBetween([0, 0, 1], [0, 0, 2])), 0);
});

test('counts sit-to-stand reps from thigh angle', () => {
  const tr = createMotionTracker();
  let t = feed(tr, hold(0, 1000));
  tr.calibrate();
  tr.setMode('reps');
  feed(tr, sitToStand(5), t);
  assert.equal(tr.state().reps, 5);
  assert.equal(tr.drainEvents().filter((e) => e.type === 'rep').length, 5);
});

test('works whatever way the phone sits in the pocket (calibration)', () => {
  // Phone rotated in the pocket: rotate every vector 90° about x, then calibrate.
  const rotate = ([x, y, z]) => [x, -z, y];
  const tr = createMotionTracker();
  let t = feed(tr, hold(0, 1000).map(rotate));
  tr.calibrate();
  tr.setMode('reps');
  feed(tr, sitToStand(3).map(rotate), t);
  assert.equal(tr.state().reps, 3);
});

test('ignores small thigh movements that never reach standing', () => {
  const tr = createMotionTracker();
  let t = feed(tr, hold(0, 1000));
  tr.calibrate();
  tr.setMode('reps');
  const shuffle = [];
  for (let i = 0; i < 6; i++) shuffle.push(...ramp(0, 40, 400), ...ramp(40, 0, 400));
  feed(tr, shuffle, t);
  assert.equal(tr.state().reps, 0);
});

test('steadiness is higher for a quiet hold than a wobbly one', () => {
  const quiet = createMotionTracker();
  let t = feed(quiet, hold(90, 500));
  quiet.setMode('hold');
  feed(quiet, hold(90, 10000, 0.05), t);
  const q = quiet.holdSummary();

  const wobbly = createMotionTracker();
  t = feed(wobbly, hold(90, 500));
  wobbly.setMode('hold');
  feed(wobbly, hold(90, 10000, 1.2), t);
  const w = wobbly.holdSummary();

  assert.ok(q.steadiness > w.steadiness, `quiet ${q.steadiness} vs wobbly ${w.steadiness}`);
  assert.ok(q.steadiness >= 80, `quiet hold should score high, got ${q.steadiness}`);
  assert.ok(Math.abs(q.durationMs - (10000 - DEFAULTS.holdSettleMs)) < 50);
  assert.equal(q.perSecond.length, 9);
});

test('movement while settling into a hold does not count against steadiness', () => {
  const tr = createMotionTracker();
  let t = feed(tr, hold(90, 500));
  tr.setMode('hold');
  t = feed(tr, hold(90, DEFAULTS.holdSettleMs - 100, 3), t); // shuffling into position, within the settle window
  feed(tr, hold(90, 8000, 0.05), t);                    // then still
  assert.ok(tr.holdSummary().steadiness >= 80, `got ${tr.holdSummary().steadiness}`);
});

test('hold_end event carries the summary when the hold finishes', () => {
  const tr = createMotionTracker();
  let t = feed(tr, hold(90, 500));
  tr.setMode('hold');
  feed(tr, hold(90, 3000, 0.05), t);
  tr.setMode('idle');
  const end = tr.drainEvents().find((e) => e.type === 'hold_end');
  assert.ok(end && end.steadiness > 0);
});

test('flags a possible fall: impact spike then stillness', () => {
  const tr = createMotionTracker();
  let t = feed(tr, hold(90, 1000));
  t = feed(tr, [[0, 3.2 * G, 0]], t);          // impact
  feed(tr, hold(0, 3000, 0.02), t);             // lying still
  assert.ok(tr.drainEvents().some((e) => e.type === 'possible_fall'));
});

test('no fall prompt when movement continues after a bump', () => {
  const tr = createMotionTracker();
  let t = feed(tr, hold(90, 1000));
  t = feed(tr, [[0, 3.2 * G, 0]], t);
  feed(tr, hold(90, 3000, 3), t);               // still moving around
  assert.ok(!tr.drainEvents().some((e) => e.type === 'possible_fall'));
});
