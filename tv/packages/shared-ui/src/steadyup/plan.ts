// Today's session. Exercises are common strength and balance moves for older
// adults; the chair is always there for support.

type StepBase = { id: string; title: string; cue: string; tips: string[]; focus: 'Strength' | 'Balance' | 'Warm up' };

export type Step =
  | (StepBase & { kind: 'timed'; seconds: number })
  | (StepBase & { kind: 'reps'; target: number; timeLimitS: number })
  | (StepBase & { kind: 'selfPaced'; target: number })
  | (StepBase & { kind: 'hold'; seconds: number });

export const TODAY: Step[] = [
  {
    kind: 'timed',
    id: 'warmup',
    focus: 'Warm up',
    tips: ['Sit tall, back away from the chair', 'Lift each knee in turn', 'Swing your arms gently'],
    title: 'Warm up: seated marching',
    cue: 'Sit tall. Lift one knee, then the other, like marching.',
    seconds: 30,
  },
  {
    kind: 'reps',
    id: 'sit-to-stand',
    focus: 'Strength',
    tips: ['Feet flat, hip-width apart', 'Lean forward, nose over toes', 'Stand tall, then sit slowly'],
    title: 'Sit to stand',
    cue: 'Feet flat. Lean forward, stand up tall, then sit down slowly. Use your hands if you need to.',
    target: 5,
    timeLimitS: 90,
  },
  {
    kind: 'selfPaced',
    id: 'heel-raises',
    focus: 'Strength',
    tips: ['Hold the chair back', 'Rise onto your toes', 'Lower slowly, count to three'],
    title: 'Heel raises',
    cue: 'Stand behind the chair and hold it. Rise onto your toes, then lower slowly.',
    target: 10,
  },
  {
    kind: 'hold',
    id: 'feet-together',
    focus: 'Balance',
    tips: ['Feet side by side', 'Look straight ahead', 'Fingertips on the chair if needed'],
    title: 'Feet together',
    cue: 'Stand with your feet side by side. Hold the chair lightly if you need it.',
    seconds: 10,
  },
  {
    kind: 'hold',
    id: 'semi-tandem',
    focus: 'Balance',
    tips: ['One foot half a step forward', 'Weight on both feet', 'Breathe normally'],
    title: 'Half step stance',
    cue: 'Place one foot half a step in front of the other.',
    seconds: 10,
  },
  {
    kind: 'hold',
    id: 'tandem',
    focus: 'Balance',
    tips: ['Heel touching toe', 'Arms relaxed by your side', 'Hold the chair if you wobble'],
    title: 'Heel to toe stance',
    cue: 'Place one foot directly in front of the other, heel touching toe.',
    seconds: 10,
  },
];

export const SESSION_MINUTES = 5;

export type StepResult =
  | { id: string; kind: 'reps'; reps: number; target: number; seconds: number }
  | { id: string; kind: 'hold'; steadiness: number; seconds: number }
  | { id: string; kind: 'timed' | 'selfPaced'; done: boolean };
