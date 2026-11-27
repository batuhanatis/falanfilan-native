import { t as translateUI, getLanguage } from "../i18n/core";
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Check, X, Zap, Trophy, Users, Star } from "lucide-react-native";
import { FONTS, upperTR } from "../theme/fonts";

// Günün Düellosu skor kartı (9:16, Story). Düello kartıyla aynı aile: koyu zemin, üstte altın spot,
// Big Shoulders puan, DM Mono künye. Kartı gören ne olduğunu anlasın diye başlıkta "Film ve dizi bilgi
// yarışması", ortada karne: her sorunun geldiği yapım ve doğru/yanlış, son satır altın soru. Soruların
// kendisi yok, kart kimsenin oyununu bozmasın. Paylaşılan görsel olduğu için renkler temadan bağımsız
// ve yazılar sistem yazı boyutuyla büyümüyor (kart sabit ölçüde yakalanıyor).
// 360x640 çiziliyor, 3x yakalanınca 1080x1920. Instagram story'de üstte profil çubuğu, altta yanıt alanı
// duruyor; yazılar üstten ve alttan yaklaşık 85 nokta içeride.
export const DAILY_CARD_WIDTH = 360;
export const DAILY_CARD_HEIGHT = 640;

const CREAM = "#f3ead8";
const DIM = "#8c8579";
const GOLD = "#c9a44c";
const INK = "#1a140b";

function seconds(ms) {
  const s = (ms / 1000).toFixed(1);
  return getLanguage() === "en" ? `${s}s` : `${s.replace(".", ",")} sn`;
}

// Sıra: az kişi oynadıysa ya da ilk üçteyse kaçıncı olduğu ("14 kişi arasında 2."; 2 kişide "ilk %1"
// yanıltıcı). Kalabalıkta üst yarıdaysa yüzdelik dilim ("ilk %12"). Ekrandaki cümle de bunu kullanıyor.
export function dailyStanding(percentile, standing) {
  if (percentile == null) return null;
  const top = Math.max(1, 100 - percentile);
  if (standing && (standing.players < 20 || standing.rank <= 3)) return { kind: "rank", rank: standing.rank, players: standing.players };
  if (top <= 50) return { kind: "top", top };
  if (standing) return { kind: "rank", rank: standing.rank, players: standing.players };
  return null;
}

export default function DailyDuelShareCard({ dayLabel, score = 0, correct = 0, total = 8, marks = [], percentile = null, standing = null, friendRank = null, friendCount = 0 }) {
  const fastest = marks.filter((m) => m.correct && Number.isFinite(m.ms)).reduce((min, m) => (min == null || m.ms < min ? m.ms : min), null);
  const golden = marks.find((m) => m.golden && m.correct && m.points > 0);
  const rank = dailyStanding(percentile, standing);
  // Karnenin altında en fazla iki kısa bilgi: en hızlı cevap ve sıra (yoksa arkadaş sırası ya da altın soru).
  const chips = [
    fastest != null && { Icon: Zap, text: translateUI("En hızlı {0}", { 0: seconds(fastest) }) },
    rank && (rank.kind === "top"
      ? { Icon: Trophy, text: translateUI("Bugün ilk %{0}", { 0: rank.top }) }
      : { Icon: Trophy, text: translateUI("{0} kişi arasında {1}.", { 0: rank.players, 1: rank.rank }) }),
    // Bugün oynayanların hepsi arkadaşsa iki bilgi aynı şeyi söylüyor; o zaman yalnızca genel sıra.
    friendRank && friendCount > 1 && !(standing && standing.players === friendCount) && { Icon: Users, text: translateUI("Arkadaşlar arasında {0}.", { 0: friendRank }) },
    golden && { Icon: Star, text: translateUI("Altın soru +{0}", { 0: golden.points }) },
  ].filter(Boolean).slice(0, 2);
  // Karne: her sorunun yapımı ve doğru/yanlış, iki sütun (1-4 solda, 5-8 sağda). Eski sunucuda yapım
  // adı yoksa yalnızca kutu şeridi.
  const withTitles = marks.length > 0 && marks.every((m) => m.title);
  const half = Math.ceil(marks.length / 2);
  const columns = [marks.slice(0, half), marks.slice(half)];

  return (
    <View style={styles.card}>
      <LinearGradient colors={["rgba(201,164,76,0.28)", "rgba(201,164,76,0)"]} style={styles.spot} />
      <Text allowFontScaling={false} style={styles.kicker}>{translateUI("PELLIX · GÜNÜN DÜELLOSU")}</Text>
      <Text allowFontScaling={false} style={styles.headline}>{translateUI("Film ve dizi bilgi yarışması")}</Text>
      {!!dayLabel && <Text allowFontScaling={false} style={styles.day}>{upperTR(dayLabel)}{translateUI(" · HERKESE AYNI 8 SORU")}</Text>}

      <Text allowFontScaling={false} style={styles.score}>{score}</Text>
      <Text allowFontScaling={false} style={styles.scoreLabel}>{translateUI("PUAN · {0} SORUDAN {1} DOĞRU", { 0: total, 1: correct })}</Text>

      {withTitles ? (
        <View style={styles.sheet}>
          <Text allowFontScaling={false} style={styles.sheetHead}>{translateUI("SORULAR BU YAPIMLARDAN")}</Text>
          <View style={styles.sheetCols}>
            {columns.map((col, ci) => (
              <View key={ci} style={styles.sheetCol}>
                {col.map((m, i) => (
                  <View key={i} style={styles.row}>
                    <View style={[styles.mini, m.correct ? styles.tileRight : styles.tileWrong, m.golden && styles.tileGolden]}>
                      {m.correct ? <Check size={12} color={INK} strokeWidth={3} /> : <X size={11} color={DIM} strokeWidth={2.5} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text allowFontScaling={false} style={[styles.rowTitle, !m.correct && { color: DIM }]} numberOfLines={m.golden ? 1 : 2}>{m.title}</Text>
                      {m.golden && <Text allowFontScaling={false} style={styles.rowGolden}>{translateUI("ALTIN SORU · 2X")}</Text>}
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      ) : marks.length > 0 ? (
        <View style={styles.strip}>
          {marks.map((m, i) => (
            <View key={i} style={[styles.tile, m.correct ? styles.tileRight : styles.tileWrong, m.golden && styles.tileGolden]}>
              {m.correct ? <Check size={16} color={INK} strokeWidth={3} /> : <X size={14} color={DIM} strokeWidth={2.5} />}
            </View>
          ))}
        </View>
      ) : null}

      {chips.length > 0 && (
        <View style={styles.chips}>
          {chips.map(({ Icon, text }) => (
            <View key={text} style={styles.chip}>
              <Icon size={11} color={GOLD} />
              <Text allowFontScaling={false} style={styles.chipText}>{text}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.foot}>
        <Text allowFontScaling={false} style={styles.footBig}>{translateUI("Sen kaç yaparsın?")}</Text>
        <Text allowFontScaling={false} style={styles.footSmall}>{translateUI("PELLIX'TE HER GÜN YENİ 8 SORU")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: DAILY_CARD_WIDTH, height: DAILY_CARD_HEIGHT, backgroundColor: "#100e10", paddingHorizontal: 24, paddingTop: 84, overflow: "hidden", alignItems: "center" },
  spot: { position: "absolute", left: 0, right: 0, top: 0, height: 340 },
  kicker: { color: GOLD, fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 2.2, textAlign: "center" },
  headline: { color: CREAM, fontFamily: FONTS.marquee, fontSize: 27, lineHeight: 30, textAlign: "center", marginTop: 6 },
  day: { color: DIM, fontFamily: FONTS.monoMedium, fontSize: 9, letterSpacing: 1.4, textAlign: "center", marginTop: 5 },
  score: { color: GOLD, fontFamily: FONTS.marquee, fontSize: 80, lineHeight: 84, textAlign: "center", marginTop: 10 },
  scoreLabel: { color: CREAM, fontFamily: FONTS.monoMedium, fontSize: 9.5, letterSpacing: 1.6, marginTop: -2 },
  sheet: { alignSelf: "stretch", marginTop: 16, borderRadius: 14, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4, backgroundColor: "rgba(243,234,216,0.04)", borderWidth: 1, borderColor: "rgba(243,234,216,0.10)" },
  sheetHead: { color: DIM, fontFamily: FONTS.monoMedium, fontSize: 8, letterSpacing: 1.4, marginBottom: 8 },
  sheetCols: { flexDirection: "row", gap: 10 },
  sheetCol: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 7, minHeight: 28, marginBottom: 6 },
  mini: { width: 20, height: 24, borderRadius: 5, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  rowTitle: { color: CREAM, fontSize: 10.5, lineHeight: 12.5, fontWeight: "800" },
  rowGolden: { color: GOLD, fontFamily: FONTS.monoMedium, fontSize: 7, letterSpacing: 0.8, marginTop: 2 },
  strip: { flexDirection: "row", gap: 6, marginTop: 20 },
  tile: { width: 30, height: 38, borderRadius: 7, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  tileRight: { backgroundColor: GOLD, borderColor: GOLD },
  tileWrong: { backgroundColor: "rgba(243,234,216,0.05)", borderColor: "rgba(243,234,216,0.16)" },
  tileGolden: { borderColor: "#ffe3a3", shadowColor: GOLD, shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  chips: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, marginTop: 12 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(201,164,76,0.45)" },
  chipText: { color: CREAM, fontSize: 10.5, fontWeight: "800" },
  foot: { position: "absolute", left: 0, right: 0, bottom: 86, alignItems: "center" },
  footBig: { color: CREAM, fontFamily: FONTS.marquee, fontSize: 28 },
  footSmall: { color: DIM, fontFamily: FONTS.monoMedium, fontSize: 9, letterSpacing: 1.4, marginTop: 4 },
});
