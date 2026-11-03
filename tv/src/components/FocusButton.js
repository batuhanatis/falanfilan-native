import React, { forwardRef, useState } from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { C } from "../theme";

// Kumandayla odaklanınca altın dolgu alan düğme. primary: odak dışında da altın kenarlı.
// nextFocusUp/Right/Down/Left (Android): odağın bu düğmeden nereye gideceğini sabitlemek için
// (ör. panodaki fragman oynatıcısına kaçmasın).
function FocusButton({ label, onPress, onFocus, primary, hasTVPreferredFocus, style, disabled, nextFocusUp, nextFocusRight, nextFocusDown, nextFocusLeft }, ref) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      onFocus={() => { setFocused(true); onFocus?.(); }}
      onBlur={() => setFocused(false)}
      hasTVPreferredFocus={hasTVPreferredFocus}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...(nextFocusUp ? { nextFocusUp } : null)}
      {...(nextFocusRight ? { nextFocusRight } : null)}
      {...(nextFocusDown ? { nextFocusDown } : null)}
      {...(nextFocusLeft ? { nextFocusLeft } : null)}
      style={[
        styles.btn,
        primary && styles.primary,
        focused && styles.focused,
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      <Text style={[styles.label, focused && { color: C.onAccent }]}>{label}</Text>
    </Pressable>
  );
}

export default forwardRef(FocusButton);

const styles = StyleSheet.create({
  btn: {
    minHeight: 44, paddingHorizontal: 22, borderRadius: 999, borderWidth: 2, borderColor: C.border,
    backgroundColor: C.surface, alignItems: "center", justifyContent: "center",
  },
  primary: { borderColor: C.accent },
  focused: { backgroundColor: C.accent, borderColor: C.accent, transform: [{ scale: 1.06 }] },
  label: { color: C.text, fontSize: 16, fontWeight: "700" },
});
