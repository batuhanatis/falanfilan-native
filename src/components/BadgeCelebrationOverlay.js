import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { X } from "lucide-react-native";
import Confetti from "./Confetti";
import { hapticSuccess } from "../utils/haptics";

// PR2 — eskiden bir rozet açmak, mesaj şeridiyle AYNI 1 saniyelik sarı bant kadar önemsiz
// görünüyordu ("Şu An Popüler" kadar bile dikkat çekmiyordu). Rozetler kalıcı bir başarı
// (user_badges tablosunda tek seferlik), bu yüzden MatchCelebration'daki tam ekran anı ile
// AYNI ağırlıkta bir kutlama hak ediyor: Confetti patlaması + yaylı büyüyen rozet kartı.
export default function BadgeCelebrationOverlay({ badge, onClose, onViewBadges }) {
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const iconRotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    hapticSuccess();
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, bounciness: 14, speed: 8 }),
      Animated.sequence([
        Animated.delay(120),
        Animated.spring(iconRotate, { toValue: 1, useNativeDriver: true, bounciness: 20 }),
      ]),
    ]).start();
  }, []);

  const spin = iconRotate.interpolate({ inputRange: [0, 1], outputRange: ["-25deg", "0deg"] });

  return (
    <Animated.View style={[styles.backdrop, { opacity }]}>
      <Confetti count={46} spread={700} />
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <X size={16} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
        <Text style={styles.eyebrow}>YENİ ROZET</Text>
        <Animated.View style={[styles.iconRing, { transform: [{ rotate: spin }] }]}>
          <Text style={styles.icon}>{badge.icon}</Text>
        </Animated.View>
        <Text style={styles.name}>{badge.name}</Text>
        <Text style={styles.desc}>{badge.desc}</Text>
        <TouchableOpacity style={styles.viewBtn} onPress={onViewBadges} activeOpacity={0.85}>
          <LinearGradient colors={["#F59E0B", "#DB2777"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.viewBtnGradient}>
            <Text style={styles.viewBtnText}>Rozetlerimi Gör</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 200,
    backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center", padding: 30,
  },
  card: {
    width: "100%", maxWidth: 320, backgroundColor: "#1A1625", borderRadius: 26, padding: 26,
    alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#F59E0B", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 14,
  },
  closeBtn: { position: "absolute", top: 14, right: 14, padding: 4, zIndex: 2 },
  eyebrow: { color: "#F59E0B", fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  iconRing: {
    width: 92, height: 92, borderRadius: 999, marginTop: 16, marginBottom: 14,
    backgroundColor: "rgba(245,158,11,0.14)", borderWidth: 2, borderColor: "#F59E0B",
    alignItems: "center", justifyContent: "center",
  },
  icon: { fontSize: 42 },
  name: { color: "#fff", fontSize: 20, fontWeight: "800", textAlign: "center" },
  desc: { color: "rgba(255,255,255,0.65)", fontSize: 12.5, marginTop: 6, textAlign: "center", lineHeight: 18 },
  viewBtn: { marginTop: 20, borderRadius: 14, overflow: "hidden", alignSelf: "stretch" },
  viewBtnGradient: { paddingVertical: 13, alignItems: "center" },
  viewBtnText: { color: "#fff", fontWeight: "800", fontSize: 13.5 },
});
