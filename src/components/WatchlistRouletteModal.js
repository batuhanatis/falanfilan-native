import React, { useState, useEffect, useRef } from "react";
import { Modal, View, Text, Image, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Dices, X, Star } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { hapticLight, hapticSuccess } from "../utils/haptics";
import Confetti from "./Confetti";

// WL5 — "Film Gecesi Ruleti": listeden slot-makinesi tarzı, yavaşlayarak duran bir animasyonla
// rastgele bir seçim yapar. "Ne izlesek?" tartışmasını doğrudan çözen, eğlenceli bir mekanik.
export default function WatchlistRouletteModal({ items, onClose, onOpenMovie, onSend }) {
  const { c } = useAppTheme();
  const styles = makeStyles(c);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [spinning, setSpinning] = useState(true);
  const [winner, setWinner] = useState(null);
  const scale = useRef(new Animated.Value(1)).current;
  const winnerOpacity = useRef(new Animated.Value(0)).current;
  const winnerScale = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    let cancelled = false;
    const finalIndex = Math.floor(Math.random() * items.length);
    // Yavaşlayan bir "reel" — her adım bir öncekinden biraz daha yavaş, gerçek bir slot
    // makinesinin durma hissini taklit ediyor.
    const totalSteps = 18 + finalIndex;
    let step = 0;
    function tick() {
      if (cancelled) return;
      setDisplayIndex((i) => (i + 1) % items.length);
      hapticLight();
      step++;
      if (step >= totalSteps) {
        setDisplayIndex(finalIndex);
        setSpinning(false);
        setWinner(items[finalIndex]);
        hapticSuccess();
        Animated.parallel([
          Animated.timing(winnerOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
          Animated.spring(winnerScale, { toValue: 1, useNativeDriver: true, bounciness: 14 }),
        ]).start();
        return;
      }
      // adım aralığı 70ms'den başlayıp ~420ms'ye kadar yavaşlıyor
      const progress = step / totalSteps;
      const delay = 70 + progress * progress * 350;
      setTimeout(tick, delay);
    }
    const startTimer = setTimeout(tick, 70);
    return () => { cancelled = true; clearTimeout(startTimer); };
  }, []);

  const current = items[displayIndex];

  return (
    <Modal visible animationType="fade" transparent onRequestClose={spinning ? undefined : onClose}>
      <View style={styles.overlay}>
        {!spinning && <Confetti count={20} spread={260} fast />}
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} disabled={spinning}>
          <X size={20} color="#fff" />
        </TouchableOpacity>

        <LinearGradient colors={["#F97316", "#DB2777", "#7C3AED"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.headerPill}>
          <Dices size={14} color="#fff" />
          <Text style={styles.headerPillText}>{spinning ? "Seçiliyor…" : "Bu Gece Bu!"}</Text>
        </LinearGradient>

        <Animated.View style={{ transform: [{ scale: spinning ? 1 : winnerScale }], opacity: spinning ? 1 : winnerOpacity }}>
          {current?.poster ? (
            <Image source={{ uri: current.poster }} style={styles.poster} />
          ) : (
            <View style={[styles.poster, { backgroundColor: c.surface2 }]} />
          )}
        </Animated.View>

        {!spinning && winner && (
          <Animated.View style={{ opacity: winnerOpacity, alignItems: "center" }}>
            <Text style={styles.winnerTitle} numberOfLines={2}>{winner.title}</Text>
            <View style={styles.winnerMetaRow}>
              <Star size={12} color={c.accent} fill={c.accent} />
              <Text style={styles.winnerMeta}>{winner.imdb} · {winner.year} · {winner.type}</Text>
            </View>
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => onSend(winner)}>
                <Text style={styles.secondaryBtnText}>Arkadaşa Gönder</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => onOpenMovie(winner)}>
                <Text style={styles.primaryBtnText}>Detaya Git</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    overlay: {
      flex: 1, backgroundColor: "rgba(10,9,14,0.94)", alignItems: "center", justifyContent: "center",
      padding: 24, gap: 18,
    },
    closeBtn: { position: "absolute", top: 54, right: 20, zIndex: 5 },
    headerPill: {
      flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999,
      paddingHorizontal: 14, paddingVertical: 7,
    },
    headerPillText: { color: "#fff", fontWeight: "800", fontSize: 12.5 },
    poster: { width: 190, height: 276, borderRadius: 16 },
    winnerTitle: { color: "#fff", fontSize: 19, fontWeight: "800", textAlign: "center", marginTop: 4 },
    winnerMetaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
    winnerMeta: { color: "rgba(255,255,255,0.8)", fontSize: 12 },
    btnRow: { flexDirection: "row", gap: 10, marginTop: 18 },
    secondaryBtn: { borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
    secondaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 12.5 },
    primaryBtn: { backgroundColor: c.accent, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
    primaryBtnText: { color: c.bg, fontWeight: "800", fontSize: 12.5 },
  });
}
