// Runs today's plan one step at a time:
// ready -> countdown -> active -> (finishing) -> result -> next step.
import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { DefaultFocus, SpatialNavigationNode, SpatialNavigationRoot } from 'react-tv-space-navigation';
import { ExerciseDemo } from './Demo';
import SteadyButton from './SteadyButton';
import { COUNTDOWN_S } from './config';
import { Step, StepResult, TODAY } from './plan';
import { useSteadyLink } from './SteadyLink';
import { px, s, steady, type } from './theme';
import { AppFrame, Card, CountdownCircle, NumberedItem, RepDots, SteadinessMeter } from './ui';

type Phase = 'ready' | 'countdown' | 'active' | 'finishing' | 'result';
const HOLD_RESULT_TIMEOUT_MS = 3000;

function resultText(step: Step, r: StepResult | undefined): string {
  if (!r) return '';
  if (r.kind === 'reps') return r.reps >= r.target ? `${r.reps} sit-to-stands ✓` : `${r.reps} of ${r.target}. Good effort.`;
  if (r.kind === 'hold') return r.steadiness >= 0 ? `Steadiness ${r.steadiness}` : 'Hold complete';
  return step.kind === 'selfPaced' ? 'Nice work ✓' : 'Done ✓';
}

export default function SessionScreen() {
  const isFocused = useIsFocused();
  const nav = useNavigation<any>();
  const link = useSteadyLink();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('ready');
  const [countdown, setCountdown] = useState(COUNTDOWN_S);
  const [elapsed, setElapsed] = useState(0);
  const [reps, setReps] = useState(0);
  const [fallPrompt, setFallPrompt] = useState(false);
  const results = useRef<StepResult[]>([]);
  const startedAt = useRef(0);

  const step = TODAY[index];
  const needsPhone = step.kind === 'reps' || step.kind === 'hold';

  // Keep the latest link in a ref so timers do not restart on every live update.
  const linkRef = useRef(link);
  linkRef.current = link;
  const repsRef = useRef(0);
  repsRef.current = reps;

  // Stop sensing when leaving the screen.
  useEffect(() => () => linkRef.current.setMode('idle'), []);

  // Phone events: reps, hold results, possible falls.
  useEffect(() => {
    return link.onEvent((ev) => {
      if (ev.type === 'rep') setReps(ev.reps);
      if (ev.type === 'possible_fall') setFallPrompt(true);
      if (ev.type === 'hold_end' && step.kind === 'hold') {
        finish({ id: step.id, kind: 'hold', steadiness: ev.steadiness, seconds: Math.round(ev.durationMs / 1000) });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link.onEvent, step]);

  function finish(result: StepResult) {
    if (results.current.some((r) => r.id === result.id)) return;
    results.current = [...results.current, result];
    linkRef.current.setMode('idle');
    setPhase('result');
  }

  function begin() {
    setReps(0);
    setElapsed(0);
    if (step.kind === 'timed' || step.kind === 'selfPaced') {
      startedAt.current = Date.now();
      setPhase('active');
      return;
    }
    setCountdown(COUNTDOWN_S);
    setPhase('countdown');
  }

  // Countdown, then start the sensor in the right mode.
  useEffect(() => {
    if (phase !== 'countdown') return;
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c > 1) return c - 1;
        clearInterval(t);
        if (step.kind === 'reps') {
          linkRef.current.calibrate(); // they are seated now
          linkRef.current.setMode('reps');
        } else {
          linkRef.current.setMode('hold');
        }
        startedAt.current = Date.now();
        setPhase('active');
        return 0;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase, step]);

  // Clock for the active step.
  useEffect(() => {
    if (phase !== 'active') return;
    const t = setInterval(() => {
      const secs = (Date.now() - startedAt.current) / 1000;
      setElapsed(secs);
      if (step.kind === 'timed' && secs >= step.seconds) finish({ id: step.id, kind: 'timed', done: true });
      if (step.kind === 'reps' && secs >= step.timeLimitS) {
        finish({ id: step.id, kind: 'reps', reps: repsRef.current, target: step.target, seconds: Math.round(secs) });
      }
      if (step.kind === 'hold' && secs >= step.seconds) {
        linkRef.current.setMode('idle'); // the phone replies with hold_end
        setPhase('finishing');
      }
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, step]);

  // Reps target reached.
  useEffect(() => {
    if (phase === 'active' && step.kind === 'reps' && reps >= step.target) {
      finish({ id: step.id, kind: 'reps', reps, target: step.target, seconds: Math.round(elapsed) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reps, phase, step]);

  // If the phone never answers with a hold result, move on anyway.
  useEffect(() => {
    if (phase !== 'finishing' || step.kind !== 'hold') return;
    const t = setTimeout(() => finish({ id: step.id, kind: 'hold', steadiness: -1, seconds: step.seconds }), HOLD_RESULT_TIMEOUT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, step]);

  function next() {
    if (index + 1 >= TODAY.length) {
      nav.replace('Summary', { results: results.current });
      return;
    }
    setIndex(index + 1);
    setPhase('ready');
  }

  function primaryAction() {
    if (fallPrompt) return <SteadyButton text="I'm OK" onSelect={() => setFallPrompt(false)} />;
    if (phase === 'ready') return <SteadyButton text="OK, start" onSelect={begin} />;
    if (phase === 'result') return <SteadyButton text={index + 1 >= TODAY.length ? 'Finish' : 'Next'} onSelect={next} />;
    if (step.kind === 'reps') {
      const done = () => finish({ id: step.id, kind: 'reps', reps: repsRef.current, target: step.target, seconds: Math.round(elapsed) });
      return <SteadyButton text="Done" onSelect={done} />;
    }
    if (step.kind === 'selfPaced') return <SteadyButton text="Done" onSelect={() => finish({ id: step.id, kind: 'selfPaced', done: true })} />;
    if (step.kind === 'timed') return <SteadyButton text="Skip" onSelect={() => finish({ id: step.id, kind: 'timed', done: false })} />;
    return <SteadyButton text="Skip" onSelect={() => finish({ id: step.id, kind: 'hold', steadiness: -1, seconds: Math.round(elapsed) })} />;
  }

  const result = results.current.find((r) => r.id === step.id);
  const secondsLeft = (seconds: number) => Math.max(0, Math.ceil(seconds - elapsed));

  const live = link.live;
  const showReps = phase === 'active' && step.kind === 'reps';
  const showHold = (phase === 'active' || phase === 'finishing') && step.kind === 'hold';

  return (
    <SpatialNavigationRoot isActive={isFocused}>
      <AppFrame progress={{ current: phase === 'result' ? index + 1 : index, total: TODAY.length }} hint="OK  select     ▶  Stop session">
        <View style={[s.row, { alignItems: 'flex-start', flex: 1, paddingBottom: px(24) }]}>
          <View style={{ flex: 1.35, marginRight: px(64), alignSelf: 'stretch' }}>
            <Text style={type.overline}>{step.focus.toUpperCase()} · EXERCISE {index + 1}</Text>
            <Text style={[type.h1, { marginTop: px(8) }]}>{step.title}</Text>
            <Text style={[type.bodyMuted, { marginTop: px(16) }]}>{step.cue}</Text>

            <View style={{ marginTop: px(40), flex: 1 }}>
              {phase === 'ready' && (
                <Card style={{ alignSelf: 'flex-start' }}>
                  <Text style={type.h2}>
                    {step.kind === 'reps'
                      ? 'Sit down on the chair, then press OK.'
                      : step.kind === 'hold'
                        ? 'Stand up and get into position, then press OK.'
                        : 'Press OK when you are ready.'}
                  </Text>
                </Card>
              )}
              {phase === 'countdown' && <CountdownCircle value={countdown} label={step.kind === 'reps' ? 'Stay seated…' : 'Get into position…'} />}

              {showReps && step.kind === 'reps' && (
                <View>
                  <View style={[s.row, { alignItems: 'flex-end' }]}>
                    <Text style={type.hero}>{reps}</Text>
                    <Text style={[type.h1, { color: steady.muted, marginLeft: px(16), marginBottom: px(40) }]}>of {step.target}</Text>
                  </View>
                  <RepDots count={reps} target={step.target} />
                </View>
              )}
              {showHold && step.kind === 'hold' && (
                <View style={{ maxWidth: px(1000) }}>
                  <View style={[s.row, { alignItems: 'flex-end' }]}>
                    <Text style={type.hero}>{secondsLeft(step.seconds)}</Text>
                    <Text style={[type.h1, { color: steady.muted, marginLeft: px(16), marginBottom: px(40) }]}>seconds</Text>
                  </View>
                  <SteadinessMeter value={live.steadiness} />
                </View>
              )}
              {phase === 'active' && step.kind === 'timed' && (
                <View style={[s.row, { alignItems: 'flex-end' }]}>
                  <Text style={type.hero}>{secondsLeft(step.seconds)}</Text>
                  <Text style={[type.h1, { color: steady.muted, marginLeft: px(16), marginBottom: px(40) }]}>seconds</Text>
                </View>
              )}
              {phase === 'active' && step.kind === 'selfPaced' && (
                <Card style={{ alignSelf: 'flex-start' }}>
                  <Text style={type.h2}>Do {step.target} at your own pace, then press Done.</Text>
                </Card>
              )}
              {phase === 'result' && (
                <View>
                  <Text style={[type.h1, { color: steady.ok }]}>{resultText(step, result)}</Text>
                  {step.kind === 'reps' && result?.kind === 'reps' && <RepDots count={result.reps} target={step.target} />}
                </View>
              )}
            </View>

            {needsPhone && !link.phoneConnected && (
              <View style={s.banner}>
                <Text style={s.bannerText}>Phone not connected, so this exercise will not be counted.</Text>
              </View>
            )}
            {fallPrompt && (
              <View style={s.banner}>
                <Text style={s.bannerText}>A sudden movement was detected. Are you OK?</Text>
              </View>
            )}

            <View style={{ marginTop: px(24) }}>
              {/* Re-mount the buttons whenever the screen changes so focus lands on the
                  main action, never on "Stop session". */}
              <SpatialNavigationNode orientation="horizontal" key={`${index}-${phase}-${fallPrompt}`}>
                <View style={s.row}>
                  <DefaultFocus>{primaryAction()}</DefaultFocus>
                  <SteadyButton text="Stop session" variant="secondary" onSelect={() => nav.popToTop()} />
                </View>
              </SpatialNavigationNode>
            </View>
          </View>

          <Card style={{ flex: 1, padding: px(40) }}>
            <View style={{ height: px(360), borderRadius: px(24), backgroundColor: steady.bg, alignItems: 'center', justifyContent: 'center' }}>
              <ExerciseDemo key={step.id} id={step.id} />
            </View>
            <Text style={[type.overline, { marginTop: px(32) }]}>TIPS</Text>
            {step.tips.map((tip, i) => (
              <NumberedItem key={tip} n={i + 1} text={tip} />
            ))}
          </Card>
        </View>
      </AppFrame>
    </SpatialNavigationRoot>
  );
}
