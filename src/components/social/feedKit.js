import { t as translateUI, getLocale } from "../../i18n/core";
import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { FONTS, upperTR } from "../../theme/fonts";

// Sosyal akış (Fuaye): her paylaşım kutusuz bir satır, kutuyu yalnızca paylaşılan nesne alıyor
// (klaket, bilet, afiş, koltuk, pano). Bu nesneler iki temada da kendi renklerinde kalır
// (bkz. Pellix Salon: slate, paper, velvet, board, film-band).
export const OBJ = {
  slate: "#1e1d1b",
  slateLine: "#34312c",
  slateMeta: "#b7ab95",
  paper: "#efe4cc",
  paperInk: "#2a2118",
  velvet: "#7a2428",
  velvetSeat: "#651d21",
  velvetDeep: "#3f1214",
  velvetEdge: "#5a1a1d",
  brass: "#d4a94a",
  billing: "#e9d8b9",
  board: "#0d0b0a",
  boardBorder: "#3a332b",
  boardDim: "#a39684",
  flapTop: "#2e2924",
  flapBottom: "#26221d",
  seam: "#070606",
  band: "#0c0b0a",
  hole: "#2f2a24",
  glow: "#ffe3a3",
  ink: "#f2ede2",
  gold: "#c9a44c",
  onAccent: "#1a140b",
  wrong: "#c2604f",
  list: "#6f9fb0",
};

export function relativeTime(value) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return translateUI("az önce");
  if (min < 60) return translateUI("{0} dk", { 0: min });
  const hour = Math.floor(min / 60);
  if (hour < 24) return translateUI("{0} sa", { 0: hour });
  const day = Math.floor(hour / 24);
  if (day < 7) return translateUI("{0} gün", { 0: day });
  return new Date(value).toLocaleDateString(getLocale(), { day: "numeric", month: "short" });
}

export function shortDate(value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return upperTR(d.toLocaleDateString(getLocale(), { day: "numeric", month: "short" }).replace(".", ""));
}

export function clockTime(value) {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
}

// Günün sorusu cevapları düşünce paylaşımı olarak "🔥 Günün Sorusu: <soru>\n\n<cevap>" biçiminde
// saklanıyor (SocialPostComposer). Akışta önek gösterilmiyor: soru klakete, cevap altına yazılıyor.
// Eski paylaşımlar da aynı yoldan geçtiği için kendiliğinden düzeliyor.
export function parseDailyQuestion(body) {
  const m = String(body || "").match(/^(?:🔥\s*)?Günün Sorusu:\s*([\s\S]*)$/);
  if (!m) return null;
  const rest = m[1];
  const idx = rest.indexOf("\n\n");
  const question = (idx >= 0 ? rest.slice(0, idx) : rest).trim();
  const answer = idx >= 0 ? rest.slice(idx + 2).trim() : "";
  if (!question) return null;
  return { question, answer };
}

export function totalReactions(counts) {
  return Object.values(counts || {}).reduce((sum, v) => sum + Number(v || 0), 0);
}

export function firstName(value) {
  return String(value || "").trim().split(/\s+/)[0] || "Pellix";
}

export function bounded(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
}

export function MonoLabel({ children, color, style, numberOfLines }) {
  return (
    <Text style={[kit.mono, color ? { color } : null, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

// Profil fotoğrafı yoksa baş harf: boş bir daire bırakmıyoruz.
export function Face({ uri, name, size = 36, ring, style }) {
  const base = { width: size, height: size, borderRadius: 999 };
  const ringStyle = ring ? { borderWidth: 2, borderColor: ring } : null;
  if (uri) return <Image source={{ uri }} style={[base, ringStyle, style]} accessibilityLabel={name || undefined} />;
  return (
    <View style={[base, ringStyle, kit.faceFallback, style]} accessibilityLabel={name || undefined}>
      <Text style={[kit.faceInitial, { fontSize: Math.round(size * 0.42) }]}>{upperTR(firstName(name).slice(0, 1))}</Text>
    </View>
  );
}

// Film şeridindeki delik sırası.
export function Sprockets() {
  return (
    <View style={kit.holes} pointerEvents="none">
      {Array.from({ length: 30 }, (_, i) => <View key={i} style={kit.hole} />)}
    </View>
  );
}

const kit = StyleSheet.create({
  mono: { fontFamily: FONTS.monoMedium, fontSize: 10.5, lineHeight: 14, letterSpacing: 1 },
  faceFallback: { backgroundColor: OBJ.flapTop, alignItems: "center", justifyContent: "center" },
  faceInitial: { color: OBJ.billing, fontFamily: FONTS.marquee },
  holes: { height: 6, flexDirection: "row", gap: 6, paddingHorizontal: 6, overflow: "hidden" },
  hole: { width: 8, height: 6, borderRadius: 1, backgroundColor: OBJ.hole },
});
