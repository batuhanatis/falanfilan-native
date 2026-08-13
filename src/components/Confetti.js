import React, { useRef, useEffect } from "react";
import { View, StyleSheet, Animated, Dimensions } from "react-native";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const DEFAULT_COLORS = ["#c9a44c", "#7C3AED", "#DB2777", "#F97316", "#0EA5E9", "#4ADE80"];

// ÖNEMLİ: Eskiden bu tam olarak MatchCelebration.js'in İÇİNDE, sadece oradan erişilebilir
// şekilde tanımlıydı. Artık paylaşılan, tekrar kullanılabilir bir bileşen — MatchCelebration
// hâlâ tam ekran/büyük ölçekte kullanıyor, Discover'daki beğeni patlaması (küçük ölçekte) ve
// ileride rozet/reaksiyon gibi diğer "küçük kutlama" anları da AYNI motoru paylaşıyor.
function ConfettiPiece({ delay, color, startX, spread, fast }) {
  const translateY = useRef(new Animated.Value(-20)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // "fast" — küçük, yerel patlamalar (ör. Discover'da bir beğeni) için MatchCelebration'ın
    // tam ekran, yavaş süzülen orijinal zamanlamasından daha kısa/çabuk bir versiyon.
    const fallDuration = fast ? 700 + Math.random() * 300 : 1800 + Math.random() * 700;
    const fadeDelay = fast ? 350 : 1200;
    const fadeDuration = fast ? 350 : 600;
    const fallDistance = spread * 0.5 + Math.random() * spread * 0.25;
    const drift = (Math.random() - 0.5) * (spread * 0.4);
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(translateY, { toValue: fallDistance, duration: fallDuration, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: drift, duration: fallDuration, useNativeDriver: true }),
        Animated.timing(rotate, { toValue: 3 + Math.random() * 3, duration: fallDuration, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(fadeDelay),
          Animated.timing(opacity, { toValue: 0, duration: fadeDuration, useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  }, []);

  const spin = rotate.interpolate({ inputRange: [0, 6], outputRange: ["0deg", "2160deg"] });

  return (
    <Animated.View
      style={{
        position: "absolute", top: 0, left: startX, width: 8, height: 12, backgroundColor: color, borderRadius: 2,
        opacity, transform: [{ translateY }, { translateX }, { rotate: spin }],
      }}
    />
  );
}

// count: kaç parça. originX: patlamanın merkezi (verilmezse ekranın üstünden, tam ekran bir
// kutlama gibi düşer — küçük bir yerel patlama için bir noktadan başlatılabilir). spread:
// parçaların ne kadar yayılacağı (px) — küçük bir buton patlaması için düşük tutulmalı.
// fast: MatchCelebration'ın orijinal, yavaş süzülen zamanlamasını DEĞİL, küçük/anlık patlamalar
// için kısa bir zamanlama kullanır.
export default function Confetti({ count = 26, colors = DEFAULT_COLORS, originX, spread = SCREEN_H * 0.5, fast = false }) {
  const pieces = useRef(
    Array.from({ length: count }, (_, i) => ({
      id: i,
      color: colors[i % colors.length],
      startX: originX != null ? originX + (Math.random() - 0.5) * 40 : Math.random() * SCREEN_W,
      delay: Math.random() * (fast ? 80 : 250),
    }))
  ).current;
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {pieces.map((p) => <ConfettiPiece key={p.id} {...p} spread={spread} fast={fast} />)}
    </View>
  );
}
