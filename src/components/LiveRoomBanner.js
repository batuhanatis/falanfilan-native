import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated, AccessibilityInfo } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronRight } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { FONTS, upperTR } from "../theme/fonts";

// Detay sayfasının altındaki canlı sohbet girişi: o içeriğin açık (ya da 24 saat içinde açılacak)
// bir odası varsa görünüyor. Seans panosu gibi koyu bir nesne; iki temada da aynı renkte.
const BOARD = { bg: "#0d0b0a", border: "#3a332b", ink: "#f2ede2", dim: "#a39684", gold: "#d4a94a", live: "#d9636f" };
const POLL_MS = 30000;

function timeOnly(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const hm = d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  return sameDay ? `BU AKŞAM ${hm}` : `${upperTR(d.toLocaleDateString("tr-TR", { day: "numeric", month: "long" }))} ${hm}`;
}

export default function LiveRoomBanner({ movieId, navigation }) {
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const [room, setRoom] = useState(null);
  const pulse = useRef(new Animated.Value(1)).current;

  const refresh = useCallback(() => {
    if (!movieId) return;
    api.liveRoomByMovie(auth.token, movieId).then((data) => setRoom(data.room || null)).catch(() => {});
  }, [auth.token, movieId]);

  useFocusEffect(useCallback(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]));

  const live = room?.status === "live";
  useEffect(() => {
    if (!live) return undefined;
    let loop = null;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) return;
      loop = Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]));
      loop.start();
    }).catch(() => {});
    return () => loop?.stop();
  }, [live, pulse]);

  if (!room) return null;
  const when = timeOnly(room.startsAt);
  const eyebrow = live ? "CANLI SOHBET" : when ? `SOHBET ODASI · ${when}` : "SOHBET ODASI · YAKINDA";
  const sub = live
    ? (room.participants > 1 ? `${room.participants} kişi içeride` : "Oda açık, gel konuşalım")
    : "Yayın saatinde açılıyor";

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) + 4 }]}>
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.88}
        onPress={() => navigation.navigate("LiveRoom", { code: room.code })}
        accessibilityRole="button"
        accessibilityLabel={`${live ? "Canlı sohbet" : "Sohbet odası"}: ${room.episodeLabel || room.title}. ${sub}. Odaya gir.`}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.eyebrowRow}>
            {live && <Animated.View style={[styles.dot, { opacity: pulse }]} />}
            <Text style={[styles.eyebrow, live && { color: BOARD.live }]} numberOfLines={1}>{eyebrow}</Text>
          </View>
          <Text style={styles.title} numberOfLines={1}>{room.episodeLabel || room.title}</Text>
          <Text style={styles.sub} numberOfLines={1}>{sub}</Text>
        </View>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>{live ? "Odaya gir" : "Göz at"}</Text>
          <ChevronRight size={16} color="#1a140b" />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 14, right: 14, zIndex: 110, elevation: 18 },
  card: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingLeft: 16, paddingRight: 12,
    borderRadius: 18, backgroundColor: BOARD.bg, borderWidth: 1, borderColor: BOARD.border,
    shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 10 },
  },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: BOARD.live },
  eyebrow: { color: BOARD.gold, fontSize: 10.5, fontFamily: FONTS.monoMedium, letterSpacing: 1, flexShrink: 1 },
  title: { color: BOARD.ink, fontSize: 24, fontFamily: FONTS.marquee, marginTop: 2 },
  sub: { color: BOARD.dim, fontSize: 12.5 },
  cta: { flexDirection: "row", alignItems: "center", gap: 2, height: 44, paddingLeft: 16, paddingRight: 10, borderRadius: 22, backgroundColor: BOARD.gold },
  ctaText: { color: "#1a140b", fontSize: 14, fontWeight: "800" },
});
