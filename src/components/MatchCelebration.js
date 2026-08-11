import React, { useRef, useEffect } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, Animated, Dimensions } from "react-native";
import * as Haptics from "expo-haptics";
import { Sparkles } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { avatarOr } from "../utils/avatar";
import RetryImage from "./RetryImage";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const CONFETTI_COLORS = ["#c9a44c", "#7C3AED", "#DB2777", "#F97316", "#0EA5E9", "#4ADE80"];
const CONFETTI_COUNT = 26;

// Tek bir konfeti parçası — yukarıdan patlayıp aşağı süzülerek dönerek düşüyor.
function ConfettiPiece({ delay, color, startX }) {
  const translateY = useRef(new Animated.Value(-20)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const fallDistance = SCREEN_H * 0.5 + Math.random() * SCREEN_H * 0.25;
    const drift = (Math.random() - 0.5) * 160;
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(translateY, { toValue: fallDistance, duration: 1800 + Math.random() * 700, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: drift, duration: 1800, useNativeDriver: true }),
        Animated.timing(rotate, { toValue: 3 + Math.random() * 3, duration: 1800, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(1200),
          Animated.timing(opacity, { toValue: 0, duration: 600, useNativeDriver: true }),
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

function ConfettiBurst() {
  const pieces = useRef(
    Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
      id: i,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      startX: Math.random() * SCREEN_W,
      delay: Math.random() * 250,
    }))
  ).current;
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {pieces.map((p) => <ConfettiPiece key={p.id} {...p} />)}
    </View>
  );
}

// Oturumdaki HER eşleşmede (ilk ya da sonraki fark etmeksizin) kaydırmayı durduran, tam ekran,
// konfetili, iki avatarın birbirine yaklaştığı bir kutlama gösteriyoruz — kullanıcı "Devam Et"
// ya da "Oturumu Bitir" demeden kendiliğinden KAPANMAZ, akışın kontrolü tamamen kullanıcıda kalır.
export default function MatchCelebration({ movie, myAvatar, myId, partnerAvatar, partnerId, partnerName, onContinue, onEndSession }) {
  const { c } = useAppTheme();
  const styles = makeStyles(c);
  const avatarL = useRef(new Animated.Value(-80)).current;
  const avatarR = useRef(new Animated.Value(80)).current;
  const cardScale = useRef(new Animated.Value(0.85)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const lightOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.parallel([
      Animated.spring(avatarL, { toValue: 0, useNativeDriver: true, bounciness: 12 }),
      Animated.spring(avatarR, { toValue: 0, useNativeDriver: true, bounciness: 12 }),
      Animated.timing(lightOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(200),
        Animated.parallel([
          Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, bounciness: 8 }),
          Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  }, []);

  return (
    <View style={styles.overlay}>
      <ConfettiBurst />
      <Animated.View style={[styles.glow, { opacity: lightOpacity }]} />

      <View style={styles.avatarsRow}>
        <Animated.View style={{ transform: [{ translateX: avatarL }] }}>
          <RetryImage source={{ uri: avatarOr(myAvatar, myId) }} style={styles.avatar} />
        </Animated.View>
        <View style={styles.heartBadge}><Text style={{ fontSize: 16 }}>🎬</Text></View>
        <Animated.View style={{ transform: [{ translateX: avatarR }] }}>
          <RetryImage source={{ uri: avatarOr(partnerAvatar, partnerId) }} style={styles.avatar} />
        </Animated.View>
      </View>

      <Animated.View style={{ opacity: cardOpacity, transform: [{ scale: cardScale }], alignItems: "center" }}>
        <Text style={styles.bigTitle}>Eşleştiniz! 🎉</Text>
        <Text style={styles.bigSubtitle}>Sen ve {partnerName} aynı fikirdesiniz</Text>

        <View style={styles.movieCard}>
          {movie.poster ? <Image source={{ uri: movie.poster }} style={styles.moviePoster} /> : <View style={[styles.moviePoster, { backgroundColor: c.surface2 }]} />}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.movieTitle} numberOfLines={2}>{movie.title}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
              <Sparkles size={11} color={c.accent} />
              <Text style={styles.movieMeta}>{movie.imdb} · {movie.year} · {movie.genre}</Text>
            </View>
          </View>
        </View>

        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.endBtn} onPress={onEndSession}>
            <Text style={styles.endBtnText}>Oturumu Bitir</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.continueBtn} onPress={onContinue}>
            <Text style={styles.continueBtnText}>Devam Et</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10,9,14,0.94)", zIndex: 50,
      alignItems: "center", justifyContent: "center", padding: 24,
    },
    glow: {
      position: "absolute", width: 420, height: 420, borderRadius: 999, top: "18%",
      backgroundColor: "#DB2777", opacity: 0.25,
    },
    avatarsRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 22 },
    avatar: { width: 68, height: 68, borderRadius: 999, borderWidth: 3, borderColor: c.accent },
    heartBadge: {
      width: 34, height: 34, borderRadius: 999, backgroundColor: c.surface,
      alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.accent,
    },
    bigTitle: { fontSize: 26, fontWeight: "900", color: "#fff", marginBottom: 4 },
    bigSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 22 },
    movieCard: {
      flexDirection: "row", gap: 12, backgroundColor: c.surface, borderRadius: 16,
      padding: 12, width: "100%", maxWidth: 320, alignItems: "center", marginBottom: 26,
    },
    moviePoster: { width: 50, height: 72, borderRadius: 8 },
    movieTitle: { fontSize: 14, fontWeight: "800", color: c.text },
    movieMeta: { fontSize: 11, color: c.dim },
    btnRow: { flexDirection: "row", gap: 10, width: "100%", maxWidth: 320 },
    endBtn: {
      flex: 1, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", borderRadius: 14,
      paddingVertical: 13, alignItems: "center",
    },
    endBtnText: { color: "rgba(255,255,255,0.8)", fontWeight: "700", fontSize: 13 },
    continueBtn: { flex: 1.4, backgroundColor: c.accent, borderRadius: 14, paddingVertical: 13, alignItems: "center" },
    continueBtnText: { color: c.bg, fontWeight: "800", fontSize: 13 },
  });
}
