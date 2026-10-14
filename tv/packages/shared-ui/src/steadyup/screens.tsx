// SteadyUp TV screens: Home, Pair phone, Safety check, Summary.
// The live exercise screen is in SessionScreen.tsx.
import React, { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { DefaultFocus, SpatialNavigationNode, SpatialNavigationRoot } from 'react-tv-space-navigation';
import SteadyButton from './SteadyButton';
import { SERVER_URL } from './config';
import { useSteadyLink } from './SteadyLink';
import type { Progress } from './SteadyLink';
import type { StepResult } from './plan';
import { SESSION_MINUTES, TODAY } from './plan';
import { px, s, steady, type } from './theme';
import { AppFrame, Card, NumberedItem, Pill, Stat } from './ui';

export type SteadyStackParamList = {
  SteadyHome: undefined;
  Pair: { next?: 'Safety' } | undefined;
  Safety: undefined;
  Session: undefined;
  Summary: { results: StepResult[] };
};

function useNav() {
  return useNavigation<any>();
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

// Streak plus steadiness trend (or sessions this week), from the phone's history.
function ProgressStats({ progress }: { progress: Progress }) {
  const improved = progress.steadinessFrom !== null && progress.steadinessTo !== null && progress.steadinessTo > progress.steadinessFrom;
  return (
    <>
      <View style={{ marginRight: px(80) }}><Stat value={`${progress.streak}`} label="day streak" color={steady.accent} /></View>
      {improved ? (
        <Stat value={`${progress.steadinessTo}`} label={`steadiness (was ${progress.steadinessFrom})`} color={steady.ok} />
      ) : (
        <Stat value={`${progress.thisWeek}`} label="sessions this week" />
      )}
    </>
  );
}

export function SteadyHomeScreen() {
  const isFocused = useIsFocused();
  const nav = useNav();
  const { phoneConnected, progress } = useSteadyLink();
  const focusCounts = TODAY.reduce<Record<string, number>>((acc, st) => ({ ...acc, [st.focus]: (acc[st.focus] ?? 0) + 1 }), {});

  return (
    <SpatialNavigationRoot isActive={isFocused}>
      <AppFrame>
        <Text style={type.overline}>{new Date().toDateString().toUpperCase()}</Text>
        <Text style={[type.display, { marginTop: px(12) }]}>{greeting()}.</Text>
        <Text style={[type.bodyMuted, { marginTop: px(16), maxWidth: px(1100) }]}>
          A few minutes of strength and balance, at your own pace. Your phone in your pocket does the counting.
        </Text>

        <View style={[s.row, { marginTop: px(40), alignItems: 'stretch' }]}>
          <Card style={{ flex: 1.4, marginRight: px(40), paddingVertical: px(40) }}>
            <Text style={type.overline}>TODAY'S SESSION</Text>
            <Text style={[type.h1, { marginTop: px(12) }]}>Strength & balance · Level 1</Text>
            <View style={[s.row, { marginTop: px(24) }]}>
              <View style={{ marginRight: px(80) }}><Stat value={`${TODAY.length}`} label="exercises" /></View>
              <View style={{ marginRight: px(80) }}><Stat value={`${SESSION_MINUTES}`} label="minutes" /></View>
              {progress && progress.sessions > 0 ? (
                <ProgressStats progress={progress} />
              ) : (
                <>
                  <View style={{ marginRight: px(80) }}><Stat value={`${focusCounts.Strength ?? 0}`} label="strength" /></View>
                  <Stat value={`${focusCounts.Balance ?? 0}`} label="balance" />
                </>
              )}
            </View>
            <View style={{ marginTop: px(32) }}>
              <SpatialNavigationNode orientation="horizontal">
                <View style={s.row}>
                  <DefaultFocus>
                    <SteadyButton
                      text="Start session"
                      onSelect={() => (phoneConnected ? nav.navigate('Safety') : nav.navigate('Pair', { next: 'Safety' }))}
                    />
                  </DefaultFocus>
                  <SteadyButton text="Pair phone" variant="secondary" onSelect={() => nav.navigate('Pair')} />
                </View>
              </SpatialNavigationNode>
            </View>
          </Card>

          <Card style={{ flex: 1, paddingVertical: px(40) }}>
            <Text style={type.overline}>HOW IT WORKS</Text>
            <NumberedItem n={1} text="Scan the code on screen with your phone." />
            <NumberedItem n={2} text="Put the phone in your front trouser pocket." />
            <NumberedItem n={3} text="Follow the TV. Your reps and balance are counted for you." />
          </Card>
        </View>
      </AppFrame>
    </SpatialNavigationRoot>
  );
}

export function PairScreen() {
  const isFocused = useIsFocused();
  const nav = useNav();
  const route = useRoute<any>();
  const { status, code, qrUri, phoneConnected, newSession } = useSteadyLink();
  const next = route.params?.next;

  // Move on by itself once the phone is connected.
  useEffect(() => {
    if (isFocused && phoneConnected && next) {
      const t = setTimeout(() => nav.replace(next), 1500);
      return () => clearTimeout(t);
    }
  }, [isFocused, phoneConnected, next, nav]);

  return (
    <SpatialNavigationRoot isActive={isFocused}>
      <AppFrame>
        <View style={[s.row, { alignItems: 'flex-start' }]}>
          <Card style={{ alignItems: 'center', marginRight: px(80), padding: px(40) }}>
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: px(24), padding: px(20) }}>
              {qrUri ? (
                <Image source={{ uri: qrUri }} style={{ width: px(440), height: px(440) }} />
              ) : (
                <View style={{ width: px(440), height: px(440) }} />
              )}
            </View>
            <Text style={[type.caption, { marginTop: px(28) }]}>or enter code</Text>
            <Text style={[type.display, { letterSpacing: px(20) }]}>{code ?? '····'}</Text>
          </Card>

          <View style={{ flex: 1 }}>
            <Text style={type.overline}>CONNECT YOUR PHONE</Text>
            <Text style={[type.h1, { marginTop: px(12) }]}>Your phone counts for you</Text>
            <NumberedItem n={1} text="Open your phone camera and point it at the code." />
            <NumberedItem n={2} text="Open the link in Chrome and tap Start." />
            <NumberedItem n={3} text="Put the phone in your front trouser pocket, screen facing your leg." />
            <View style={{ marginTop: px(48), alignSelf: 'flex-start' }}>
              {status === 'error' ? (
                <Pill label="Cannot reach the SteadyUp server" color={steady.bad} />
              ) : phoneConnected ? (
                <Pill label={next ? 'Connected. Starting…' : 'Connected'} color={steady.ok} />
              ) : (
                <Pill label="Waiting for your phone…" color={steady.accent} />
              )}
            </View>
            <View style={{ marginTop: px(48) }}>
              <SpatialNavigationNode orientation="horizontal">
                <View style={s.row}>
                  <DefaultFocus>
                    <SteadyButton
                      text={phoneConnected ? 'Continue' : 'Back'}
                      onSelect={() => (phoneConnected && next ? nav.replace(next) : nav.goBack())}
                    />
                  </DefaultFocus>
                  <SteadyButton text="New code" variant="secondary" onSelect={newSession} />
                </View>
              </SpatialNavigationNode>
            </View>
          </View>
        </View>
      </AppFrame>
    </SpatialNavigationRoot>
  );
}

const SAFETY = [
  'A sturdy chair without wheels is within reach.',
  'The floor around you is clear.',
  'You are wearing shoes, or are barefoot (no socks).',
  'You feel well today. Stop if you feel dizzy or unwell.',
];

export function SafetyScreen() {
  const isFocused = useIsFocused();
  const nav = useNav();
  return (
    <SpatialNavigationRoot isActive={isFocused}>
      <AppFrame>
        <Text style={type.overline}>BEFORE WE START</Text>
        <Text style={[type.display, { marginTop: px(12) }]}>Quick safety check</Text>
        <Card style={{ marginTop: px(32), maxWidth: px(1400), paddingTop: px(24), paddingBottom: px(40) }}>
          {SAFETY.map((line) => (
            <NumberedItem key={line} n="✓" text={line} />
          ))}
        </Card>
        <View style={{ marginTop: px(32) }}>
          <SpatialNavigationNode orientation="horizontal">
            <View style={s.row}>
              <DefaultFocus>
                <SteadyButton text="All good, let's start" onSelect={() => nav.replace('Session')} />
              </DefaultFocus>
              <SteadyButton text="Not today" variant="secondary" onSelect={() => nav.goBack()} />
            </View>
          </SpatialNavigationNode>
        </View>
        <Text style={[type.caption, { marginTop: px(24) }]}>
          SteadyUp is not a medical device. Ask your doctor before starting a new exercise programme.
        </Text>
      </AppFrame>
    </SpatialNavigationRoot>
  );
}

function resultValue(r: StepResult): { value: string; label: string; color: string } {
  if (r.kind === 'reps') return { value: `${r.reps}/${r.target}`, label: 'reps', color: r.reps >= r.target ? steady.ok : steady.text };
  if (r.kind === 'hold') return r.steadiness >= 0
    ? { value: `${r.steadiness}`, label: 'steadiness', color: r.steadiness >= 70 ? steady.ok : steady.accent }
    : { value: '–', label: 'not measured', color: steady.muted };
  return { value: r.done ? '✓' : '–', label: r.done ? 'done' : 'skipped', color: r.done ? steady.ok : steady.muted };
}

type Coach = { text: string; source: 'bedrock' | 'rules' } | 'loading' | 'error';

// Personal message from the AI coach (Amazon Bedrock on the server), also read aloud.
function useCoach(results: StepResult[]): Coach {
  const [coach, setCoach] = useState<Coach>('loading');
  const { say, progress } = useSteadyLink();
  useEffect(() => {
    let cancelled = false;
    const payload = results.map((r) => ({ ...r, title: TODAY.find((st) => st.id === r.id)?.title ?? r.id }));
    // Earlier sessions from the phone, so the coach can mention real progress.
    const history = progress?.recent ?? [];
    fetch(`${SERVER_URL}/api/coach`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ results: payload, history }) })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((body) => {
        if (cancelled) return;
        setCoach(body);
        say(`Well done. ${body.text}`);
      })
      .catch(() => !cancelled && setCoach('error'));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return coach;
}

export function SummaryScreen() {
  const isFocused = useIsFocused();
  const nav = useNav();
  const route = useRoute<any>();
  const results: StepResult[] = route.params?.results ?? [];
  const holds = results.filter((r): r is Extract<StepResult, { kind: 'hold' }> => r.kind === 'hold' && r.steadiness >= 0);
  const best = holds.length ? Math.max(...holds.map((h) => h.steadiness)) : null;
  const reps = results.find((r): r is Extract<StepResult, { kind: 'reps' }> => r.kind === 'reps');
  const coach = useCoach(results);
  const { recordSession, progress } = useSteadyLink();
  useEffect(() => {
    recordSession({ reps: reps?.reps ?? 0, best, exercises: results.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SpatialNavigationRoot isActive={isFocused}>
      <AppFrame>
        <View style={[s.row, { justifyContent: 'space-between', alignItems: 'flex-end' }]}>
          <View>
            <Text style={type.overline}>SESSION COMPLETE</Text>
            <Text style={[type.display, { marginTop: px(12) }]}>Well done ★</Text>
          </View>
          <View style={s.row}>
            {progress && progress.streak > 0 ? (
              <View style={{ marginLeft: px(96) }}><Stat value={`${progress.streak}`} label="day streak" color={steady.ok} /></View>
            ) : (
              <View style={{ marginLeft: px(96) }}><Stat value={`${results.length}`} label="exercises done" color={steady.ok} /></View>
            )}
            {reps && <View style={{ marginLeft: px(96) }}><Stat value={`${reps.reps}`} label="sit-to-stands" /></View>}
            {best !== null && <View style={{ marginLeft: px(96) }}><Stat value={`${best}`} label="best steadiness" color={steady.accent} /></View>}
          </View>
        </View>

        {/* Results in two columns (2 x 490 + 16 = 996) and the coach beside them (32 + 700). */}
        <View style={[s.row, { alignItems: 'stretch', marginTop: px(32) }]}>
          <View style={[s.row, { width: px(996), flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start' }]}>
            {results.map((r) => {
              const step = TODAY.find((st) => st.id === r.id);
              const v = resultValue(r);
              return (
                <Card key={r.id} style={{ width: px(490), marginBottom: px(16), paddingVertical: px(20), paddingHorizontal: px(32) }}>
                  <View style={[s.row, { justifyContent: 'space-between' }]}>
                    <Text style={[type.overline, { color: steady.faint }]}>{step?.focus.toUpperCase()}</Text>
                    <View style={[s.row, { alignItems: 'flex-end' }]}>
                      <Text style={[type.h2, { color: v.color }]}>{v.value}</Text>
                      <Text style={[type.caption, { marginLeft: px(12), marginBottom: px(6) }]}>{v.label}</Text>
                    </View>
                  </View>
                  <Text style={[type.body, { fontSize: px(32), fontWeight: '700' }]} numberOfLines={1}>{step?.title ?? r.id}</Text>
                </Card>
              );
            })}
          </View>
          <Card style={{ width: px(700), marginLeft: px(32), marginBottom: px(16), paddingVertical: px(32), paddingHorizontal: px(40) }}>
            <View style={[s.row, { justifyContent: 'space-between' }]}>
              <Text style={type.overline}>YOUR COACH</Text>
              {typeof coach === 'object' && coach.source === 'bedrock' && (
                <Text style={[type.caption, { color: steady.faint }]}>AI · Amazon Bedrock</Text>
              )}
            </View>
            <Text style={[type.bodyMuted, { color: steady.text, marginTop: px(16) }]} numberOfLines={8}>
              {coach === 'loading' ? 'Looking at today\'s results…' : coach === 'error' ? 'Great session. See you tomorrow!' : coach.text}
            </Text>
          </Card>
        </View>

        <View style={{ marginTop: px(16), alignSelf: 'flex-start' }}>
          <DefaultFocus>
            <SteadyButton text="Back to home" onSelect={() => nav.popToTop()} />
          </DefaultFocus>
        </View>
      </AppFrame>
    </SpatialNavigationRoot>
  );
}
