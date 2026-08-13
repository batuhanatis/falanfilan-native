import React, { useRef, useEffect } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, Animated } from "react-native";
import * as Haptics from "expo-haptics";
import { Sparkles } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { avatarOr } from "../utils/avatar";
import RetryImage from "./RetryImage";
import Confetti from "./Confetti";

// Oturumdaki HER eşleşmede (ilk ya da sonraki fark etmeksizin) kaydırmayı durduran, tam ekran,
// konfetili, iki avatarın birbirine yaklaştığı bir kutlama gösteriyoruz — kullanıcı "Devam Et"
// ya da "Oturumu Bitir" demeden kendiliğinden KAPANMAZ, akışın kontrolü tamamen kullanıcıda kalır.
export default function MatchCelebration({ movie, matchNumber, myAvatar, myId, partnerAvatar, partnerId, partnerName, onContinue, onEndSession }) {
  const { c } = useAppTheme();
  const styles = makeStyles(c);
  // MP5 — aynı oturumda arka arkaya eşleşmeler hep birebir aynı kutlamayı gösterirse birkaç
  // eşleşme sonra sıradanlaşıyor. Her 5. eşleşme (5, 10, 15...) daha büyük bir konfeti +
  // farklı bir başlık alıyor, tekrar tekrar oynayan bir animasyon yerine küçük bir "seri" hissi.
  const isMilestone = !!matchNumber && matchNumber % 5 === 0;
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
      <Confetti count={isMilestone ? 50 : 26} />
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
        <Text style={styles.bigTitle}>{isMilestone ? `${matchNumber}. Eşleşme! 🔥` : "Eşleştiniz! 🎉"}</Text>
        <Text style={styles.bigSubtitle}>
          {isMilestone ? `Bu oturumda ${partnerName} ile ${matchNumber} kez anlaştınız` : `Sen ve ${partnerName} aynı fikirdesiniz`}
        </Text>

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
