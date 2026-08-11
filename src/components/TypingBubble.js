import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";

// Klasik, birbirini kovalayan üç nokta animasyonu — WhatsApp/iMessage'daki "yazıyor" baloncuğuna
// benzer. Her nokta, bir öncekinden hafif gecikmeli olarak yukarı-aşağı zıplıyor. Bu her zaman
// KARŞI TARAFIN yazdığını gösterdiği için (kendi yazdığımızı göstermiyoruz), her zaman sola
// hizalı — "bubbleTheirs" ile aynı renk paletini kullanması için renkler dışarıdan veriliyor.
export default function TypingBubble({ bubbleColor, dotColor }) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    function bounce(dot, delay) {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -4, duration: 260, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 260, useNativeDriver: true }),
          Animated.delay(600 - delay),
        ])
      );
    }
    const anims = [bounce(dot1, 0), bounce(dot2, 130), bounce(dot3, 260)];
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, []);

  return (
    <View style={styles.wrap}>
      <View style={[styles.bubble, { backgroundColor: bubbleColor }]}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View
            key={i}
            style={[styles.dot, { backgroundColor: dotColor, transform: [{ translateY: dot }] }]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 14, marginBottom: 10, alignItems: "flex-start" },
  bubble: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 18, borderBottomLeftRadius: 4,
  },
  dot: { width: 6, height: 6, borderRadius: 999 },
});
