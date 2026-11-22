import { t as translateUI } from "../../i18n/core";
import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, AccessibilityInfo } from "react-native";
import { Scissors, ChevronsUp, Snowflake, MessageCircle, Sparkles } from "lucide-react-native";
import { SALON } from "../salon/SalonKit";
import { FONTS } from "../../theme/fonts";
import { hapticLight, hapticSelection } from "../../utils/haptics";

// Düellonun oyun içi ekleri:
//  - Altın soru: son normal soru, puanlar 2 kat. Soru üstünde nabız gibi atan altın şerit.
//  - Joker koçanları: düello başına bir joker. Kullanılan koçan yırtılır (yerinde "kullanıldı"),
//    diğerleri kapanır. Yarı yarıya iki yanlış şıkkı eler, çift puan doğru cevabı ikiye katlar,
//    süre durdur hız puanını dondurur.
//  - Laf atma: hazır cümleler (serbest metin yok); rakibin ekranında konuşma balonu olarak patlar.

export const JOKER_META = {
  fifty: { label: "Yarı yarıya", hint: "İki yanlış şık elenir", icon: Scissors },
  double: { label: "Çift puan", hint: "Bilirsen 2 kat puan", icon: ChevronsUp },
  freeze: { label: "Süre durdur", hint: "Hız puanı donar", icon: Snowflake },
};
export const JOKER_KEYS = ["fifty", "double", "freeze"];

export const TAUNT_TEXT = {
  easy: "Kolaydı.",
  lucky: "Şanslıydın.",
  knew: "Bunu biliyordum!",
  fast: "Hızıma yetişemezsin.",
  wait: "Bekle sen, daha bitmedi.",
  rematch: "Rövanş!",
  gg: "İyi oyundu.",
  byheart: "Ezbere biliyorum.",
};
export const TAUNT_KEYS = Object.keys(TAUNT_TEXT);

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled?.().then((r) => setReduce(!!r)).catch(() => {}); }, []);
  return reduce;
}

// ---------- altın soru ----------
export function GoldenBanner({ c }) {
  const reduce = useReduceMotion();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduce]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });
  return (
    <Animated.View style={[x.golden, { borderColor: c.accent, transform: [{ scale }] }]} accessibilityRole="text" accessibilityLabel={translateUI("Altın soru: puanlar 2 kat")}>
      <Sparkles size={14} color={SALON.onGold} />
      <Text style={x.goldenText}>{translateUI("ALTIN SORU · PUANLAR 2 KAT")}</Text>
    </Animated.View>
  );
}

// ---------- jokerler ----------
// mine: bu düelloda kullandığım joker { type, index } ya da null. index: şu anki soru.
export function JokerTray({ c, mine, index, canUse, onUse }) {
  const [busy, setBusy] = useState(null);
  useEffect(() => { if (mine) setBusy(null); }, [mine?.type]);
  if (mine && mine.index !== index) {
    return <Text style={[x.jokerNote, { color: c.dim }]}>{translateUI("Jokerini {0}. soruda kullandın: {1}", { 0: mine.index + 1, 1: translateUI(JOKER_META[mine.type]?.label || "") })}</Text>;
  }
  return (
    <View style={x.trayWrap}>
      <Text style={[x.trayLabel, { color: c.dim }]}>{mine ? translateUI("BU SORUDA JOKERİN") : translateUI("JOKER · DÜELLO BAŞINA BİR")}</Text>
      <View style={x.tray}>
        {JOKER_KEYS.map((k) => {
          const m = JOKER_META[k];
          const Icon = m.icon;
          const used = mine?.type === k;
          const off = !!mine && !used;
          const disabled = !!mine || !canUse || !!busy;
          return (
            <TouchableOpacity
              key={k}
              style={[x.joker, { backgroundColor: c.surface, borderColor: used ? c.accent : c.border }, used && { backgroundColor: SALON.goldTint }, off && { opacity: 0.35 }]}
              disabled={disabled}
              onPress={() => { hapticSelection(); setBusy(k); onUse(k); }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`${translateUI(m.label)}: ${translateUI(m.hint)}`}
              accessibilityState={{ disabled, selected: used }}
            >
              <Icon size={15} color={used ? c.accent : c.text} />
              <Text style={[x.jokerLabel, { color: c.text }]} numberOfLines={1}>{translateUI(m.label)}</Text>
              <Text style={[x.jokerHint, { color: c.dim }]} numberOfLines={1}>{used ? translateUI("Kullanıldı") : translateUI(m.hint)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// Puan ve çarpanlar: "+576 · altın 2x · çift puan 2x"
export function pointsLine(points, { golden, joker }) {
  const tags = [];
  if (golden) tags.push(translateUI("altın 2x"));
  if (joker === "double") tags.push(translateUI("çift puan 2x"));
  if (joker === "freeze") tags.push(translateUI("süre durdu"));
  return [translateUI("+{0} puan", { 0: points }), ...tags].join(" · ");
}

// ---------- laf atma ----------
export function TauntBar({ c, onSend }) {
  const [open, setOpen] = useState(false);
  const [cool, setCool] = useState(false);
  const send = (k) => {
    if (cool) return;
    hapticLight();
    onSend(k);
    setOpen(false);
    setCool(true);
    setTimeout(() => setCool(false), 2600);
  };
  return (
    <View style={x.tauntWrap}>
      <TouchableOpacity
        style={[x.tauntBtn, { borderColor: c.border, backgroundColor: c.surface }, cool && { opacity: 0.5 }]}
        onPress={() => { hapticSelection(); setOpen((v) => !v); }}
        disabled={cool}
        accessibilityRole="button"
        accessibilityLabel={translateUI("Laf at")}
        accessibilityState={{ expanded: open }}
      >
        <MessageCircle size={14} color={c.accent} />
        <Text style={[x.tauntBtnText, { color: c.text }]}>{translateUI("Laf at")}</Text>
      </TouchableOpacity>
      {open && (
        <View style={x.chips}>
          {TAUNT_KEYS.map((k) => (
            <TouchableOpacity key={k} style={[x.chip, { borderColor: SALON.goldLine, backgroundColor: SALON.goldTint }]} onPress={() => send(k)} accessibilityRole="button">
              <Text style={[x.chipText, { color: c.text }]}>{translateUI(TAUNT_TEXT[k])}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// Konuşma balonu: büyükten oturur, 2.6 sn sonra söner. side: "left" (ben) | "right" (rakip).
export function TauntBubble({ taunt, side = "right", name }) {
  const [shown, setShown] = useState(null);
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!taunt) return undefined;
    setShown(taunt);
    pop.setValue(0);
    Animated.sequence([
      Animated.spring(pop, { toValue: 1, damping: 9, stiffness: 220, useNativeDriver: true }),
      Animated.delay(2100),
      Animated.timing(pop, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(({ finished }) => { if (finished) setShown(null); });
    return undefined;
  }, [taunt?.at]);
  if (!shown) return null;
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  return (
    <Animated.View
      pointerEvents="none"
      style={[x.bubble, side === "right" ? x.bubbleRight : x.bubbleLeft, side === "right" ? { backgroundColor: SALON.cream } : { backgroundColor: "#c9a44c" }, { opacity: pop, transform: [{ scale }] }]}
      accessibilityLiveRegion="polite"
    >
      {!!name && <Text style={x.bubbleName}>{name}</Text>}
      <Text style={x.bubbleText}>{translateUI(TAUNT_TEXT[shown.key] || "")}</Text>
      <View style={[x.tail, side === "right" ? { right: 22, borderTopColor: SALON.cream } : { left: 22, borderTopColor: "#c9a44c" }]} />
    </Animated.View>
  );
}

const x = StyleSheet.create({
  golden: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#c9a44c", borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginTop: 10, shadowColor: "#c9a44c", shadowOpacity: 0.7, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
  goldenText: { color: SALON.onGold, fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1.2 },
  trayWrap: { marginTop: 6 },
  trayLabel: { fontFamily: FONTS.monoMedium, fontSize: 8.5, letterSpacing: 1.1, marginBottom: 6 },
  tray: { flexDirection: "row", gap: 7 },
  joker: { flex: 1, minHeight: 64, borderWidth: 1, borderStyle: "dashed", borderRadius: 12, padding: 8, gap: 3 },
  jokerLabel: { fontSize: 11.5, fontWeight: "800" },
  jokerHint: { fontSize: 9.5 },
  jokerNote: { fontSize: 11, textAlign: "center", marginTop: 8 },
  tauntWrap: { marginTop: 12, alignItems: "center" },
  tauntBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  tauntBtnText: { fontSize: 12, fontWeight: "800" },
  chips: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, marginTop: 10 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  chipText: { fontSize: 12, fontWeight: "700" },
  bubble: { position: "absolute", top: 58, maxWidth: "70%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, zIndex: 20, shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  bubbleRight: { right: 12 },
  bubbleLeft: { left: 12 },
  bubbleName: { color: "#5a4a26", fontFamily: FONTS.monoMedium, fontSize: 8.5, letterSpacing: 1, marginBottom: 2 },
  bubbleText: { color: SALON.onGold, fontFamily: FONTS.marquee, fontSize: 20, lineHeight: 22 },
  tail: { position: "absolute", bottom: -9, width: 0, height: 0, borderLeftWidth: 9, borderRightWidth: 9, borderTopWidth: 10, borderLeftColor: "transparent", borderRightColor: "transparent" },
});
