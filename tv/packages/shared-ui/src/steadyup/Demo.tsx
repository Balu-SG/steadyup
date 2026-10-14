// Looping demo animations for each exercise, drawn with plain Views so they
// render the same on Android TV, Fire TV and Vega OS (no SVG, no video files).
// Moves done next to the chair are shown from the side; the balance stances are
// shown from above, because foot placement is what matters there.
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { px, steady, type } from './theme';

// Drawing canvas, in design pixels.
const W = 600;
const H = 340;
const FLOOR = 326;
const LIMB = 16;
const RAD = Math.PI / 180;

// ---------- animation clock ----------

// Loop position 0..1, updated at about 30 fps.
function useLoop(ms: number): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    const start = Date.now();
    let last = 0;
    let raf = requestAnimationFrame(function tick() {
      const now = Date.now();
      if (now - last > 33) {
        last = now;
        setT(((now - start) % ms) / ms);
      }
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [ms]);
  return t;
}

type Num = number | { [k: string]: Num };
function lerp<T extends Num>(a: T, b: T, u: number): T {
  if (typeof a === 'number') return (a + ((b as number) - a) * u) as T;
  const out: any = {};
  for (const k of Object.keys(a)) out[k] = lerp((a as any)[k], (b as any)[k], u);
  return out;
}

// Eased value along keyframes [{at, v}] with at from 0 to 1.
function frame<T extends Num>(keys: { at: number; v: T }[], t: number): T {
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].at) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const u = Math.min(1, Math.max(0, (t - a.at) / (b.at - a.at || 1)));
  return lerp(a.v, b.v, u * u * (3 - 2 * u));
}

// ---------- side-view figure ----------

type Pt = { x: number; y: number };
// Angles in degrees: 0 points up, 90 points forward (right), 180 points down.
type Leg = { thigh: number; shin: number; foot: number };
type Arm = { upper: number; fore: number };
type Pose = { torso: number; near: Leg; far: Leg; nearArm: Arm; farArm: Arm };

const LEN = { thigh: 78, shin: 78, foot: 30, heel: 8, torso: 84, neck: 32, upper: 56, fore: 52 };
const along = (p: Pt, deg: number, len: number): Pt => ({ x: p.x + Math.sin(deg * RAD) * len, y: p.y - Math.cos(deg * RAD) * len });

function legJoints(hip: Pt, l: Leg) {
  const knee = along(hip, l.thigh, LEN.thigh);
  const ankle = along(knee, l.shin, LEN.shin);
  return { knee, ankle, heel: along(ankle, l.foot, -LEN.heel), toe: along(ankle, l.foot, LEN.foot) };
}
function armJoints(shoulder: Pt, a: Arm) {
  const elbow = along(shoulder, a.upper, LEN.upper);
  return { elbow, hand: along(elbow, a.fore, LEN.fore) };
}

// Solve the skeleton, then move it so either the hip or the near toe sits on `root`.
function solve(p: Pose, root: { hip: Pt } | { toe: Pt }) {
  const hip0 = { x: 0, y: 0 };
  const near0 = legJoints(hip0, p.near);
  const off = 'hip' in root ? root.hip : { x: root.toe.x - near0.toe.x, y: root.toe.y - near0.toe.y };
  const hip = { x: off.x, y: off.y };
  const shoulder = along(hip, p.torso, LEN.torso * 0.9);
  return {
    hip,
    neck: along(hip, p.torso, LEN.torso),
    head: along(hip, p.torso, LEN.torso + LEN.neck),
    shoulder,
    near: legJoints(hip, p.near),
    far: legJoints(hip, p.far),
    nearArm: armJoints(shoulder, p.nearArm),
    farArm: armJoints(shoulder, p.farArm),
  };
}

function Bone({ a, b, w = LIMB, color }: { a: Pt; b: Pt; w?: number; color: string }) {
  const len = Math.hypot(b.x - a.x, b.y - a.y) + w;
  const angle = Math.atan2(b.y - a.y, b.x - a.x) / RAD;
  return (
    <View
      style={{
        position: 'absolute',
        left: px((a.x + b.x) / 2 - len / 2),
        top: px((a.y + b.y) / 2 - w / 2),
        width: px(len),
        height: px(w),
        borderRadius: px(w / 2),
        backgroundColor: color,
        transform: [{ rotate: `${angle}deg` }],
      }}
    />
  );
}

function Figure({ pose, root, farShift = -10 }: { pose: Pose; root: { hip: Pt } | { toe: Pt }; farShift?: number }) {
  const j = solve(pose, root);
  const shift = (p: Pt) => ({ x: p.x + farShift, y: p.y });
  const far = steady.muted;
  const near = steady.text;
  const headR = 24;
  return (
    <>
      {/* far side first, so the near side draws on top */}
      <Bone a={shift(j.hip)} b={shift(j.far.knee)} color={far} />
      <Bone a={shift(j.far.knee)} b={shift(j.far.ankle)} color={far} />
      <Bone a={shift(j.far.heel)} b={shift(j.far.toe)} w={12} color={far} />
      <Bone a={j.shoulder} b={j.farArm.elbow} w={14} color={far} />
      <Bone a={j.farArm.elbow} b={j.farArm.hand} w={14} color={far} />
      <Bone a={j.hip} b={j.neck} w={28} color={near} />
      <View
        style={{
          position: 'absolute',
          left: px(j.head.x - headR),
          top: px(j.head.y - headR),
          width: px(headR * 2),
          height: px(headR * 2),
          borderRadius: px(headR),
          backgroundColor: near,
        }}
      />
      <Bone a={j.hip} b={j.near.knee} color={near} />
      <Bone a={j.near.knee} b={j.near.ankle} color={near} />
      <Bone a={j.near.heel} b={j.near.toe} w={12} color={near} />
      <Bone a={j.shoulder} b={j.nearArm.elbow} w={14} color={steady.accent} />
      <Bone a={j.nearArm.elbow} b={j.nearArm.hand} w={14} color={steady.accent} />
    </>
  );
}

// Side view of a chair. `facing` is the side the seat extends to from the back.
function Chair({ backX, seatY, depth = 84, backTop, facing = 1 }: { backX: number; seatY: number; depth?: number; backTop: number; facing?: 1 | -1 }) {
  const c = steady.faint;
  const frontX = backX + depth * facing;
  return (
    <>
      <Bone a={{ x: backX, y: backTop }} b={{ x: backX, y: FLOOR }} w={10} color={c} />
      <Bone a={{ x: backX, y: seatY }} b={{ x: frontX, y: seatY }} w={12} color={c} />
      <Bone a={{ x: frontX, y: seatY }} b={{ x: frontX, y: FLOOR }} w={10} color={c} />
    </>
  );
}

function Floor() {
  return <View style={{ position: 'absolute', left: px(40), top: px(FLOOR + 6), width: px(W - 80), height: px(4), borderRadius: px(2), backgroundColor: steady.surfaceHigh }} />;
}

const relaxed = (torso: number): Arm => ({ upper: torso + 170, fore: torso + 150 });

// Seated marching: knees lift in turn, arms swing.
const SIT_HIP = { x: 250, y: FLOOR - 7 - LEN.shin };
const down: Leg = { thigh: 90, shin: 180, foot: 90 };
const up: Leg = { thigh: 58, shin: 160, foot: 105 };
const fwd: Arm = { upper: 150, fore: 95 };
const back: Arm = { upper: 205, fore: 150 };
const MARCH: { at: number; v: Pose }[] = [
  { at: 0, v: { torso: 4, near: up, far: down, nearArm: back, farArm: fwd } },
  { at: 0.5, v: { torso: 4, near: down, far: up, nearArm: fwd, farArm: back } },
  { at: 1, v: { torso: 4, near: up, far: down, nearArm: back, farArm: fwd } },
];

function MarchDemo() {
  const t = useLoop(2000);
  const seatY = SIT_HIP.y + 12;
  return (
    <>
      <Chair backX={SIT_HIP.x - 56} seatY={seatY} backTop={seatY - 130} />
      <Floor />
      <Figure pose={frame(MARCH, t)} root={{ hip: SIT_HIP }} farShift={10} />
    </>
  );
}

// Sit to stand: lean forward (nose over toes), stand tall, then sit down slowly.
const STAND_TOE = { x: 340, y: FLOOR - 1 };
const sitP = (torso: number, thigh: number, shin: number): Pose => {
  const leg = { thigh, shin, foot: 90 };
  const arm: Arm = { upper: torso + 145, fore: torso + 110 };
  return { torso, near: leg, far: leg, nearArm: arm, farArm: arm };
};
const SIT_TO_STAND: { at: number; v: Pose }[] = [
  { at: 0, v: sitP(8, 90, 180) },
  { at: 0.1, v: sitP(8, 90, 180) },
  { at: 0.25, v: sitP(42, 92, 194) },
  { at: 0.4, v: sitP(18, 150, 186) },
  { at: 0.5, v: sitP(0, 180, 180) },
  { at: 0.62, v: sitP(0, 180, 180) },
  { at: 0.76, v: sitP(22, 145, 188) },
  { at: 0.9, v: sitP(40, 94, 192) },
  { at: 1, v: sitP(8, 90, 180) },
];
const SEATED = solve(SIT_TO_STAND[0].v, { toe: STAND_TOE });

function SitToStandDemo() {
  const t = useLoop(4200);
  const seatY = SEATED.hip.y + 12;
  return (
    <>
      <Chair backX={SEATED.hip.x - 56} seatY={seatY} backTop={seatY - 130} />
      <Floor />
      <Figure pose={frame(SIT_TO_STAND, t)} root={{ toe: STAND_TOE }} />
    </>
  );
}

// Heel raises: standing behind the chair, hands on its back.
const HEEL_TOE = { x: 290, y: FLOOR - 1 };
const straight: Leg = { thigh: 180, shin: 180, foot: 90 };
const raised: Leg = { thigh: 180, shin: 180, foot: 126 };
const HOLD_ARM: Arm = { upper: 150, fore: 105 };
const FLAT: Pose = { torso: 0, near: straight, far: straight, nearArm: HOLD_ARM, farArm: HOLD_ARM };
const GRIP = solve(FLAT, { toe: HEEL_TOE }).nearArm.hand;
// When the body rises, bend the elbow more so the hand stays on the chair.
const raisedArm = ((): Arm => {
  let best = HOLD_ARM;
  let err = Infinity;
  for (let fore = 90; fore <= 180; fore += 1) {
    for (let upper = 140; upper <= 175; upper += 1) {
      const arm = { upper, fore };
      const hand = solve({ ...FLAT, near: raised, far: raised, nearArm: arm, farArm: arm }, { toe: HEEL_TOE }).nearArm.hand;
      const e = Math.hypot(hand.x - GRIP.x, hand.y - GRIP.y);
      if (e < err) [err, best] = [e, arm];
    }
  }
  return best;
})();
const UP: Pose = { torso: 0, near: raised, far: raised, nearArm: raisedArm, farArm: raisedArm };
const HEEL_RAISE: { at: number; v: Pose }[] = [
  { at: 0, v: FLAT },
  { at: 0.15, v: FLAT },
  { at: 0.35, v: UP },
  { at: 0.5, v: UP },
  { at: 0.9, v: FLAT }, // lower slowly
  { at: 1, v: FLAT },
];

function HeelRaiseDemo() {
  const t = useLoop(3200);
  return (
    <>
      <Chair backX={GRIP.x + 6} seatY={FLOOR - 96} backTop={GRIP.y + 4} />
      <Floor />
      <Figure pose={frame(HEEL_RAISE, t)} root={{ toe: HEEL_TOE }} />
    </>
  );
}

// ---------- top-down stances ----------

const FOOT_W = 44;
const FOOT_L = 104;
type Feet = { lx: number; ly: number; rx: number; ry: number };
const APART: Feet = { lx: 250, ly: 190, rx: 350, ry: 190 };
const STANCES: Record<string, Feet> = {
  'feet-together': { lx: 277, ly: 190, rx: 323, ry: 190 },
  'semi-tandem': { lx: 277, ly: 205, rx: 323, ry: 150 },
  tandem: { lx: 300, ly: 248, rx: 300, ry: 142 },
};

function Foot({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <View
      style={{
        position: 'absolute',
        left: px(x - FOOT_W / 2),
        top: px(y - FOOT_L / 2),
        width: px(FOOT_W),
        height: px(FOOT_L),
        borderTopLeftRadius: px(FOOT_W / 2),
        borderTopRightRadius: px(FOOT_W / 2),
        borderBottomLeftRadius: px(18),
        borderBottomRightRadius: px(18),
        backgroundColor: color,
      }}
    />
  );
}

function StanceDemo({ id }: { id: string }) {
  const t = useLoop(4000);
  const target = STANCES[id];
  const feet = frame(
    [
      { at: 0, v: APART },
      { at: 0.12, v: APART },
      { at: 0.38, v: target },
      { at: 0.86, v: target },
      { at: 1, v: APART },
    ],
    t,
  );
  // A gentle sway while holding the stance.
  const holding = t > 0.38 && t < 0.86;
  const sway = holding ? Math.sin((t - 0.38) * 2 * Math.PI * 3) * 6 : 0;
  const cx = (feet.lx + feet.rx) / 2 + sway;
  const cy = (feet.ly + feet.ry) / 2;
  const ring = 30;
  return (
    <>
      {/* the chair, seen from above, within reach */}
      <View style={{ position: 'absolute', left: px(440), top: px(140), width: px(100), height: px(100), borderRadius: px(12), borderWidth: px(6), borderColor: steady.faint }} />
      <Foot x={feet.lx} y={feet.ly} color={steady.text} />
      <Foot x={feet.rx} y={feet.ry} color={steady.accent} />
      <View
        style={{
          position: 'absolute',
          left: px(cx - ring),
          top: px(cy - ring),
          width: px(ring * 2),
          height: px(ring * 2),
          borderRadius: px(ring),
          borderWidth: px(4),
          borderColor: holding ? steady.ok : 'transparent',
        }}
      />
      <Text style={[type.caption, { position: 'absolute', left: 0, right: 0, top: px(H - 40), textAlign: 'center', color: steady.faint }]}>
        Seen from above · toes point up
      </Text>
    </>
  );
}

// ---------- public ----------

export function ExerciseDemo({ id }: { id: string }) {
  let body: React.ReactNode = null;
  if (id === 'warmup') body = <MarchDemo />;
  else if (id === 'sit-to-stand') body = <SitToStandDemo />;
  else if (id === 'heel-raises') body = <HeelRaiseDemo />;
  else if (STANCES[id]) body = <StanceDemo id={id} />;
  return <View style={{ width: px(W), height: px(H), overflow: 'hidden' }}>{body}</View>;
}
