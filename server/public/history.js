// Session history, kept on the user's phone (localStorage): private, no account,
// and it follows the person rather than the TV. Runs in the browser and in Node tests.

export const MAX_SESSIONS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

// Local calendar date as YYYY-MM-DD.
export function dayOf(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// Calendar arithmetic on YYYY-MM-DD strings (no time zones involved).
const parts = (day) => day.split('-').map(Number);
const prevDay = (day) => {
  const [y, m, d] = parts(day);
  return dayOf(new Date(y, m - 1, d - 1));
};
const daysBetween = (a, b) => {
  const [ya, ma, da] = parts(a);
  const [yb, mb, db] = parts(b);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / DAY_MS);
};

const num = (n, min, max) => (Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : null);

// A finished session as sent by the TV, reduced to what we keep.
export function toRecord(session, date = dayOf()) {
  return {
    date,
    reps: num(session?.reps, 0, 999) ?? 0,
    best: num(session?.best, 0, 100),
    exercises: num(session?.exercises, 0, 50) ?? 0,
  };
}

export function addSession(history, record) {
  return [...history, record].slice(-MAX_SESSIONS);
}

// Consecutive days with a session, ending today (or yesterday, so the streak
// doesn't look broken before today's session).
export function streak(history, today = dayOf()) {
  const days = new Set(history.map((s) => s.date));
  let day = days.has(today) ? today : prevDay(today);
  let count = 0;
  while (days.has(day)) {
    count += 1;
    day = prevDay(day);
  }
  return count;
}

export function stats(history, today = dayOf()) {
  const thisWeek = history.filter((s) => daysBetween(s.date, today) < 7).length;
  const scored = history.filter((s) => s.best !== null && daysBetween(s.date, today) < 14);
  return {
    sessions: history.length,
    streak: streak(history, today),
    thisWeek,
    // Best steadiness at the start and end of the last two weeks, for "72 -> 84".
    steadinessFrom: scored.length >= 2 ? scored[0].best : null,
    steadinessTo: scored.length >= 2 ? scored.at(-1).best : null,
    recent: history.slice(-7),
  };
}

export function shareText(history, today = dayOf()) {
  const s = stats(history, today);
  const last = history.at(-1);
  const out = ['SteadyUp update:'];
  if (s.streak > 1) out.push(`${s.streak}-day streak.`);
  if (last) {
    out.push(`Latest session: ${last.reps} sit-to-stands${last.best !== null ? `, best steadiness ${last.best}/100` : ''}.`);
  }
  out.push(`${s.thisWeek} session${s.thisWeek === 1 ? '' : 's'} this week.`);
  if (s.steadinessFrom !== null && s.steadinessTo > s.steadinessFrom) {
    out.push(`Steadiness up from ${s.steadinessFrom} to ${s.steadinessTo}.`);
  }
  return out.join(' ');
}
