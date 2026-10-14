// AI coach for the session summary: a short, personal message written by a model
// on Amazon Bedrock (Converse API). When Bedrock is not configured, is slow, or
// fails, a rule-based message is used instead, so the TV always has something to show.
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

export const DEFAULT_MODEL_ID = 'us.amazon.nova-lite-v1:0';
const TIMEOUT_MS = 8000;
const MAX_RESULTS = 12;

const SYSTEM_PROMPT = `You are a warm, encouraging exercise coach for older adults who just finished a
5-minute strength and balance routine at home, guided by their TV. Write exactly two short
sentences, 35 words at most in total: first celebrate one specific result from today, then give
one practical tip for next time. Steadiness is a 0-100 score from phone motion sensors; higher
means steadier. If any steadiness is below 60, suggest resting fingertips on the chair. If earlier sessions
are listed, you may mention one real improvement or the habit of coming back, using only the
numbers given. Plain
text only: no emoji, no lists, no medical advice or diagnosis, and never mention falling or
fall risk.`;

const clean = (s, max = 40) => String(s ?? '').replace(/[^\p{L}\p{N} .,'-]/gu, '').slice(0, max);
const num = (n, min, max) => (Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : null);

// Keep only the fields we understand, in a bounded form (the body comes from any client).
export function sanitizeResults(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, MAX_RESULTS).flatMap((r) => {
    if (!r || typeof r !== 'object') return [];
    const title = clean(r.title || r.id);
    if (r.kind === 'reps') return [{ title, kind: 'reps', reps: num(r.reps, 0, 999), target: num(r.target, 1, 999), seconds: num(r.seconds, 0, 3600) }];
    if (r.kind === 'hold') return [{ title, kind: 'hold', steadiness: num(r.steadiness, -1, 100), seconds: num(r.seconds, 0, 3600) }];
    if (r.kind === 'timed' || r.kind === 'selfPaced') return [{ title, kind: r.kind, done: Boolean(r.done) }];
    return [];
  });
}

// Earlier sessions kept on the user's phone: [{date, reps, best}], oldest first.
export function sanitizeHistory(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(-7).flatMap((s) => {
    if (!s || typeof s !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(String(s.date))) return [];
    return [{ date: s.date, reps: num(s.reps, 0, 999) ?? 0, best: num(s.best, 0, 100) }];
  });
}

export function describeHistory(history) {
  return history
    .map((s) => `- ${s.date}: ${s.reps} sit-to-stands${s.best !== null ? `, best steadiness ${s.best}/100` : ''}`)
    .join('\n');
}

export function describe(results) {
  return results
    .map((r) => {
      if (r.kind === 'reps') return `- ${r.title}: ${r.reps} of ${r.target} reps in ${r.seconds} s`;
      if (r.kind === 'hold') return `- ${r.title}: ${r.steadiness >= 0 ? `steadiness ${r.steadiness}/100` : 'not measured'}`;
      return `- ${r.title}: ${r.done ? 'done' : 'skipped'}`;
    })
    .join('\n');
}

export function fallbackMessage(results) {
  const reps = results.find((r) => r.kind === 'reps');
  const holds = results.filter((r) => r.kind === 'hold' && r.steadiness >= 0);
  const best = holds.length ? holds.reduce((a, b) => (b.steadiness > a.steadiness ? b : a)) : null;
  const first = reps && reps.reps > 0
    ? `${reps.reps} sit-to-stands today, nicely done.`
    : best
      ? `Your steadiest hold today was ${best.title.toLowerCase()}, at ${best.steadiness}.`
      : 'You showed up and moved today, and that is what counts.';
  const tip = holds.some((h) => h.steadiness < 60)
    ? 'Next time, rest your fingertips on the chair during the balance holds.'
    : 'Next time, try standing up a little more slowly and smoothly.';
  return `${first} ${tip}`;
}

export function createCoach({
  client = process.env.AWS_ACCESS_KEY_ID ? new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? 'us-east-1' }) : null,
  modelId = process.env.BEDROCK_MODEL_ID ?? DEFAULT_MODEL_ID,
  timeoutMs = TIMEOUT_MS,
} = {}) {
  return async function coach(rawResults, rawHistory) {
    const results = sanitizeResults(rawResults);
    const history = sanitizeHistory(rawHistory);
    const prompt = `Today's results:\n${describe(results)}${history.length ? `\n\nEarlier sessions (oldest first):\n${describeHistory(history)}` : ''}`;
    const fallback = { text: fallbackMessage(results), source: 'rules' };
    if (!client || results.length === 0) return fallback;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    try {
      const out = await client.send(
        new ConverseCommand({
          modelId,
          system: [{ text: SYSTEM_PROMPT }],
          messages: [{ role: 'user', content: [{ text: prompt }] }],
          inferenceConfig: { maxTokens: 160, temperature: 0.6 },
        }),
        { abortSignal: abort.signal },
      );
      const text = out.output?.message?.content?.map((c) => c.text ?? '').join('').trim();
      return text ? { text: text.slice(0, 400), source: 'bedrock' } : fallback;
    } catch (err) {
      console.warn('Bedrock coach failed, using rules:', err.name, err.message);
      return fallback;
    } finally {
      clearTimeout(timer);
    }
  };
}
