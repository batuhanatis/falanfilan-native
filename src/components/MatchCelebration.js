import React, { useEffect, useRef } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, Animated, Easing, AccessibilityInfo } from "react-native";
import * as Haptics from "expo-haptics";
import { useAppTheme } from "../context/ThemeContext";
import { avatarOr } from "../utils/avatar";
import { FONTS, upperTR } from "../theme/fonts";
import KnotHeart from "./salon/KnotHeart";

// Oturumdaki HER eşleşmede kaydırmayı durduran tam ekran kutlama: iki kişinin avatarından çıkan
// noktalar ortada kalp örüyor (Düğüm), kalbin ortasına eşleşilen filmin afişi oturuyor. Kullanıcı
// "Devam Et" ya da "Oturumu Bitir" demeden kendiliğinden KAPANMAZ, akışın kontrolü kullanıcıda.
export default function MatchCelebration({ movie, matchNumber, myAvatar, myId, partnerAvatar, partnerId, partnerName, onContinue, onEndSession }) {
  const { c } = useAppTheme();
  const styles = makeStyles(c);
  // MP5 — her 5. eşleşme (5, 10, 15...) farklı bir başlık alıyor, küçük bir "seri" hissi.
  const isMilestone = !!matchNumber && matchNumber % 5 === 0;
  const textIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    AccessibilityInfo.announceForAccessibility?.(`Eşleştiniz. ${movie?.title || ""}`);
    // Yazı, kalp örülmeye yakınken geliyor; düğmeler hemen dokunulabilir.
    Animated.timing(textIn, { toValue: 1, duration: 420, delay: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);

  const meta = [movie?.year, movie?.genre, movie?.imdb ? `IMDb ${movie.imdb}` : null].filter(Boolean).join("  ·  ");

  return (
    <View style={styles.overlay}>
      <KnotHeart
        leftAvatar={{ uri: avatarOr(myAvatar, myId) }}
        rightAvatar={{ uri: avatarOr(partnerAvatar, partnerId) }}
        center={movie?.poster
          ? <Image source={{ uri: movie.poster }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <View style={[StyleSheet.absoluteFill, { backgroundColor: c.surface2 }]} />}
      />

      <Animated.View
        style={[styles.textBlock, { opacity: textIn, transform: [{ translateY: textIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}
        accessibilityLiveRegion="polite"
      >
        <Text style={styles.eyebrow}>{isMilestone ? `${matchNumber}. EŞLEŞME` : "EŞLEŞME"}</Text>
        <Text style={styles.bigTitle}>{isMilestone ? `${matchNumber} kez anlaştınız` : "Eşleştiniz"}</Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {movie?.title ? `${partnerName} ile ikiniz de "${movie.title}" dediniz` : `Sen ve ${partnerName} aynı fikirdesiniz`}
        </Text>
        {!!meta && <Text style={styles.meta} numberOfLines={1}>{upperTR(meta)}</Text>}
      </Animated.View>

      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.endBtn} onPress={onEndSession} accessibilityRole="button">
          <Text style={styles.endBtnText}>Oturumu Bitir</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.continueBtn} onPress={onContinue} accessibilityRole="button">
          <Text style={styles.continueBtnText}>Devam Et</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    // Kutlama karanlık bir salon: iki temada da koyu kalıyor.
    overlay: {
      ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(14,12,18,0.97)", zIndex: 50,
      alignItems: "center", justifyContent: "center", paddingBottom: 12,
    },
    textBlock: { alignItems: "center", paddingHorizontal: 24, marginTop: 4 },
    eyebrow: { fontFamily: FONTS.monoMedium, fontSize: 11, letterSpacing: 2, color: "#c9a44c", marginBottom: 4 },
    bigTitle: { fontFamily: FONTS.marquee, fontSize: 40, lineHeight: 42, color: "#f2ede2", textAlign: "center" },
    subtitle: { fontSize: 14, color: "rgba(242,237,226,0.75)", textAlign: "center", marginTop: 6, maxWidth: 320 },
    meta: { fontFamily: FONTS.mono, fontSize: 11, color: "rgba(242,237,226,0.55)", marginTop: 8 },
    btnRow: { flexDirection: "row", gap: 10, width: "100%", maxWidth: 340, paddingHorizontal: 16, marginTop: 24 },
    endBtn: {
      flex: 1, minHeight: 48, borderWidth: 1, borderColor: "rgba(242,237,226,0.25)", borderRadius: 999,
      alignItems: "center", justifyContent: "center",
    },
    endBtnText: { color: "rgba(242,237,226,0.85)", fontWeight: "700", fontSize: 14 },
    continueBtn: { flex: 1.4, minHeight: 48, backgroundColor: "#c9a44c", borderRadius: 999, alignItems: "center", justifyContent: "center" },
    continueBtnText: { color: "#1a140b", fontWeight: "800", fontSize: 14 },
  });
}
