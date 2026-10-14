import { StyleSheet } from 'react-native';
import { scaledPixels as px } from '../hooks/useScale';

// 10-foot UI: high contrast, warm accent, sizes for reading from a sofa.
// Only plain Views are used (no SVG/gradients) so it renders the same on Vega OS.
export const steady = {
  bg: '#0B2A2B',
  glow: 'rgba(242, 181, 68, 0.07)',
  surface: '#123B3C',
  surfaceHigh: '#18494A',
  line: 'rgba(255, 255, 255, 0.08)',
  text: '#F4F1E8',
  muted: '#A9C4C1',
  faint: '#6F8F8C',
  accent: '#F2B544',
  ok: '#7ED492',
  bad: '#FF8A7A',
  onAccent: '#1C1C1C',
};

export const type = StyleSheet.create({
  overline: { color: steady.accent, fontSize: px(26), fontWeight: '800', letterSpacing: px(4) },
  display: { color: steady.text, fontSize: px(96), fontWeight: '800', lineHeight: px(108) },
  h1: { color: steady.text, fontSize: px(64), fontWeight: '800', lineHeight: px(76) },
  h2: { color: steady.text, fontSize: px(44), fontWeight: '700', lineHeight: px(56) },
  body: { color: steady.text, fontSize: px(36), lineHeight: px(50) },
  bodyMuted: { color: steady.muted, fontSize: px(34), lineHeight: px(48) },
  caption: { color: steady.muted, fontSize: px(28), lineHeight: px(38) },
  hero: { color: steady.text, fontSize: px(240), fontWeight: '800', lineHeight: px(256) },
});

export const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  card: {
    backgroundColor: steady.surface,
    borderRadius: px(32),
    borderWidth: 1,
    borderColor: steady.line,
    padding: px(48),
  },
  banner: { backgroundColor: steady.bad, borderRadius: px(20), paddingVertical: px(20), paddingHorizontal: px(32), marginTop: px(24) },
  bannerText: { color: steady.onAccent, fontSize: px(32), fontWeight: '700' },
});

export { px };
