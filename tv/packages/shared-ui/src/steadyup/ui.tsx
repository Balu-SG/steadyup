// SteadyUp UI building blocks (plain Views, so they render the same on Vega OS).
import React from 'react';
import { Text, View, ViewStyle } from 'react-native';
import { useSteadyLink } from './SteadyLink';
import { px, s, steady, type } from './theme';

// Full-screen frame: soft glow, header (logo, optional progress, phone status), footer hint.
export function AppFrame({
  children,
  progress,
  hint = '◀ ▶  move     OK  select     BACK  go back',
}: {
  children: React.ReactNode;
  progress?: { current: number; total: number };
  hint?: string;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: steady.bg, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', width: px(1400), height: px(1400), borderRadius: px(700), backgroundColor: steady.glow, top: -px(700), left: -px(400) }} />
      <View style={[s.row, { paddingHorizontal: px(96), paddingTop: px(56), justifyContent: 'space-between' }]}>
        <Logo />
        {progress ? <StepProgress {...progress} /> : <View />}
        <PhonePill />
      </View>
      <View style={{ flex: 1, paddingHorizontal: px(96), paddingTop: px(48) }}>{children}</View>
      <Text style={[type.caption, { color: steady.faint, paddingHorizontal: px(96), paddingBottom: px(40) }]}>{hint}</Text>
    </View>
  );
}

export function Logo() {
  return (
    <View style={s.row}>
      <View style={{ width: px(64), height: px(64), borderRadius: px(18), backgroundColor: steady.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: steady.onAccent, fontSize: px(40), fontWeight: '900' }}>S</Text>
      </View>
      <Text style={{ color: steady.text, fontSize: px(40), fontWeight: '800', marginLeft: px(20) }}>SteadyUp</Text>
    </View>
  );
}

export function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[s.row, { backgroundColor: steady.surface, borderRadius: px(999), borderWidth: 1, borderColor: steady.line, paddingVertical: px(14), paddingHorizontal: px(28) }]}>
      <View style={{ width: px(18), height: px(18), borderRadius: px(9), backgroundColor: color, marginRight: px(14) }} />
      <Text style={[type.caption, { color: steady.text, fontWeight: '700' }]}>{label}</Text>
    </View>
  );
}

export function PhonePill() {
  const { phoneConnected } = useSteadyLink();
  return <Pill label={phoneConnected ? 'Phone connected' : 'Phone not connected'} color={phoneConnected ? steady.ok : steady.bad} />;
}

// Segmented progress through today's exercises.
export function StepProgress({ current, total }: { current: number; total: number }) {
  return (
    <View style={s.row}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            width: px(72),
            height: px(12),
            borderRadius: px(6),
            marginHorizontal: px(6),
            backgroundColor: i < current ? steady.ok : i === current ? steady.accent : steady.surfaceHigh,
          }}
        />
      ))}
      <Text style={[type.caption, { marginLeft: px(20), color: steady.text, fontWeight: '700' }]}>
        {Math.min(current + 1, total)} / {total}
      </Text>
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

// One dot per target rep, filled as reps are counted.
export function RepDots({ count, target }: { count: number; target: number }) {
  return (
    <View style={[s.row, { marginTop: px(24) }]}>
      {Array.from({ length: target }, (_, i) => (
        <View
          key={i}
          style={{
            width: px(56),
            height: px(56),
            borderRadius: px(28),
            marginRight: px(20),
            backgroundColor: i < count ? steady.ok : 'transparent',
            borderWidth: px(4),
            borderColor: i < count ? steady.ok : steady.surfaceHigh,
          }}
        />
      ))}
    </View>
  );
}

export function CountdownCircle({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ alignItems: 'center', alignSelf: 'flex-start' }}>
      <View style={{ width: px(320), height: px(320), borderRadius: px(160), borderWidth: px(10), borderColor: steady.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[type.hero, { fontSize: px(180), lineHeight: px(200) }]}>{value}</Text>
      </View>
      <Text style={[type.bodyMuted, { marginTop: px(24) }]}>{label}</Text>
    </View>
  );
}

export function SteadinessMeter({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 70 ? steady.ok : pct >= 40 ? steady.accent : steady.bad;
  return (
    <View>
      <View style={{ height: px(40), borderRadius: px(20), backgroundColor: steady.surfaceHigh, overflow: 'hidden', marginTop: px(24) }}>
        <View style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: px(20) }} />
      </View>
      <View style={[s.row, { justifyContent: 'space-between', marginTop: px(12) }]}>
        <Text style={type.caption}>Wobbly</Text>
        <Text style={type.caption}>Steady</Text>
      </View>
    </View>
  );
}

// Numbered checklist item.
export function NumberedItem({ n, text }: { n: number | string; text: string }) {
  return (
    <View style={[s.row, { marginTop: px(28), alignItems: 'flex-start' }]}>
      <View style={{ width: px(60), height: px(60), borderRadius: px(30), backgroundColor: steady.surfaceHigh, alignItems: 'center', justifyContent: 'center', marginRight: px(28) }}>
        <Text style={{ color: steady.accent, fontSize: px(30), fontWeight: '800' }}>{n}</Text>
      </View>
      <Text style={[type.body, { flex: 1, paddingTop: px(4) }]}>{text}</Text>
    </View>
  );
}

export function Stat({ value, label, color = steady.text }: { value: string; label: string; color?: string }) {
  return (
    <View>
      <Text style={[type.h1, { color }]}>{value}</Text>
      <Text style={type.caption}>{label}</Text>
    </View>
  );
}
