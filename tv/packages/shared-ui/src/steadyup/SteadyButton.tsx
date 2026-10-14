import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SpatialNavigationFocusableView } from 'react-tv-space-navigation';
import { px, steady } from './theme';

// Large, high-contrast button: amber when focused so it is obvious from the sofa.
// "secondary" buttons are outlined until focused.
export default function SteadyButton({
  text,
  onSelect,
  variant = 'primary',
}: {
  text: string;
  onSelect: () => void;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <SpatialNavigationFocusableView onSelect={onSelect}>
      {({ isFocused }) => (
        <Pressable
          onPress={onSelect}
          style={[styles.button, variant === 'secondary' && styles.secondary, isFocused && styles.focused]}
        >
          <Text style={[styles.text, isFocused && styles.focusedText]}>{text}</Text>
        </Pressable>
      )}
    </SpatialNavigationFocusableView>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: steady.surfaceHigh,
    paddingVertical: px(28),
    paddingHorizontal: px(60),
    borderRadius: px(999),
    borderWidth: px(4),
    borderColor: 'transparent',
    marginRight: px(28),
    alignItems: 'center',
  },
  secondary: { backgroundColor: 'transparent', borderColor: steady.surfaceHigh },
  focused: { backgroundColor: steady.accent, borderColor: steady.accent, transform: [{ scale: 1.06 }] },
  text: { color: steady.text, fontSize: px(36), fontWeight: '800' },
  focusedText: { color: steady.onAccent },
});
