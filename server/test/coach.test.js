import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createCoach, describe, describeHistory, fallbackMessage, sanitizeHistory, sanitizeResults } from '../src/coach.js';
import { createServer } from '../src/index.js';

const RESULTS = [
  { id: 'sit-to-stand', title: 'Sit to stand', kind: 'reps', reps: 5, target: 5, seconds: 21 },
  { id: 'tandem', title: 'Heel to toe stance', kind: 'hold', steadiness: 55, seconds: 10 },
  { id: 'warmup', title: 'Warm up: seated marching', kind: 'timed', done: true },
];

test('sanitizeResults keeps known fields only and bounds numbers and text', () => {
  const out = sanitizeResults([
    { kind: 'reps', title: 'Sit <script>to</script> stand', reps: 1e9, target: 5, seconds: -4, extra: 'x' },
    { kind: 'unknown' },
    'nope',
  ]);
  assert.deepEqual(out, [{ title: 'Sit scripttoscript stand', kind: 'reps', reps: 999, target: 5, seconds: 0 }]);
  assert.deepEqual(sanitizeResults('not an array'), []);
});

test('describe turns results into plain lines for the model', () => {
  assert.equal(describe(sanitizeResults(RESULTS)), '- Sit to stand: 5 of 5 reps in 21 s\n- Heel to toe stance: steadiness 55/100\n- Warm up seated marching: done');
});

test('fallback message praises a result and suggests the chair when wobbly', () => {
  const text = fallbackMessage(sanitizeResults(RESULTS));
  assert.match(text, /^5 sit-to-stands today/);
  assert.match(text, /fingertips on the chair/);
});

test('coach uses Bedrock Converse output when available', async () => {
  let sent;
  const client = { send: async (cmd) => ((sent = cmd.input), { output: { message: { content: [{ text: ' Great stands! Go slower next time. ' }] } } }) };
  const coach = createCoach({ client, modelId: 'test-model' });
  assert.deepEqual(await coach(RESULTS), { text: 'Great stands! Go slower next time.', source: 'bedrock' });
  assert.equal(sent.modelId, 'test-model');
  assert.match(sent.messages[0].content[0].text, /Sit to stand: 5 of 5 reps/);
});

test('coach falls back to rules when Bedrock fails or is not configured', async () => {
  const failing = createCoach({ client: { send: async () => { throw new Error('AccessDenied'); } } });
  assert.equal((await failing(RESULTS)).source, 'rules');
  const off = createCoach({ client: null });
  assert.equal((await off(RESULTS)).source, 'rules');
});

test('coach gives up on a slow model and uses rules', async () => {
  const slow = { send: (_cmd, { abortSignal }) => new Promise((_, reject) => abortSignal.addEventListener('abort', () => reject(new Error('aborted')))) };
  const coach = createCoach({ client: slow, timeoutMs: 50 });
  assert.equal((await coach(RESULTS)).source, 'rules');
});

test('POST /api/coach returns a message and rate-limits a busy client', async () => {
  const server = createServer({ coach: async () => ({ text: 'hi', source: 'rules' }) });
  server.listen(0);
  await once(server, 'listening');
  const url = `http://localhost:${server.address().port}/api/coach`;
  const post = (body) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
  const ok = await post(JSON.stringify({ results: RESULTS }));
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { text: 'hi', source: 'rules' });
  assert.equal((await post('{not json')).status, 400);
  let last;
  for (let i = 0; i < 20; i++) last = await post('{}');
  assert.equal(last.status, 429);
  server.close();
});

test('earlier sessions are cleaned and passed to the model', async () => {
  const history = sanitizeHistory([{ date: '2026-10-12', reps: 4, best: 72, x: 1 }, { date: 'yesterday', reps: 1 }, { date: '2026-10-13', reps: 5, best: null }]);
  assert.deepEqual(history, [{ date: '2026-10-12', reps: 4, best: 72 }, { date: '2026-10-13', reps: 5, best: null }]);
  assert.equal(describeHistory(history), '- 2026-10-12: 4 sit-to-stands, best steadiness 72/100\n- 2026-10-13: 5 sit-to-stands');
  let sent;
  const client = { send: async (cmd) => ((sent = cmd.input), { output: { message: { content: [{ text: 'ok' }] } } }) };
  await createCoach({ client })(RESULTS, history);
  assert.match(sent.messages[0].content[0].text, /Earlier sessions \(oldest first\):\n- 2026-10-12: 4 sit-to-stands/);
});
