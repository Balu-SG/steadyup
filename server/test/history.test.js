import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addSession, MAX_SESSIONS, shareText, stats, streak, toRecord } from '../public/history.js';

const rec = (date, reps = 5, best = 80) => ({ date, reps, best, exercises: 6 });

test('toRecord keeps bounded numbers only', () => {
  assert.deepEqual(toRecord({ reps: 5.4, best: 140, exercises: 6, junk: 1 }, '2026-10-14'), { date: '2026-10-14', reps: 5, best: 100, exercises: 6 });
  assert.deepEqual(toRecord({}, '2026-10-14'), { date: '2026-10-14', reps: 0, best: null, exercises: 0 });
});

test('addSession keeps the most recent sessions only', () => {
  let h = [];
  for (let i = 0; i < MAX_SESSIONS + 5; i++) h = addSession(h, rec('2026-10-01', i));
  assert.equal(h.length, MAX_SESSIONS);
  assert.equal(h[0].reps, 5);
});

test('streak counts consecutive days, across a month boundary', () => {
  const h = [rec('2026-09-29'), rec('2026-09-30'), rec('2026-10-01'), rec('2026-10-01')];
  assert.equal(streak(h, '2026-10-01'), 3);
  assert.equal(streak(h, '2026-10-02'), 3, 'not broken before today\'s session');
  assert.equal(streak(h, '2026-10-03'), 0, 'a missed day ends it');
  assert.equal(streak([], '2026-10-01'), 0);
});

test('stats: sessions this week and steadiness trend', () => {
  const h = [rec('2026-09-20', 3, 60), rec('2026-10-08', 4, 72), rec('2026-10-12', 5, 79), rec('2026-10-14', 5, 84)];
  const s = stats(h, '2026-10-14');
  assert.equal(s.thisWeek, 3);
  assert.equal(s.steadinessFrom, 72);
  assert.equal(s.steadinessTo, 84);
  assert.equal(s.streak, 1);
  assert.equal(s.recent.length, 4);
});

test('shareText is a short summary for family', () => {
  const h = [rec('2026-10-12', 4, 72), rec('2026-10-13', 5, 79), rec('2026-10-14', 5, 84)];
  assert.equal(shareText(h, '2026-10-14'), 'SteadyUp update: 3-day streak. Latest session: 5 sit-to-stands, best steadiness 84/100. 3 sessions this week. Steadiness up from 72 to 84.');
});
