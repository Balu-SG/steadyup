// Turns frames recorded by `E2E_RECORD=<dir> node scripts/e2e-tv.mjs ...` into an MP4.
// Each frame is shown for as long as it was on screen, divided by the playback
// speed marked at that moment (long waits are sped up).
// Usage: node scripts/make-video.mjs <frames-dir> <out.mp4>
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [dir, out] = process.argv.slice(2);
const frames = readdirSync(dir).filter((f) => f.endsWith('.jpg')).map((f) => ({ f, t: Number(f.slice(0, -4)) })).sort((a, b) => a.t - b.t);
const marks = JSON.parse(readFileSync(join(dir, 'marks.json'), 'utf8'));
const speedAt = (t) => marks.filter((m) => m.t <= t).pop()?.speed ?? 1;

let list = '';
for (let i = 0; i < frames.length; i++) {
  const next = frames[i + 1]?.t ?? frames[i].t + 100;
  list += `file '${resolve(dir, frames[i].f)}'\nduration ${((next - frames[i].t) / 1000 / speedAt(frames[i].t)).toFixed(4)}\n`;
}
list += `file '${resolve(dir, frames.at(-1).f)}'\n`; // concat needs the last frame twice
writeFileSync(join(dir, 'frames.txt'), list);

execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(dir, 'frames.txt'),
  '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '20', '-movflags', '+faststart', out], { stdio: 'inherit' });
console.log(`wrote ${out} from ${frames.length} frames`);
