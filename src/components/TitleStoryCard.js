import { t as translateUI, getLanguage } from "../i18n/core";
import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { FONTS, upperTR } from "../theme/fonts";
import { platformName, platformLogo } from "../utils/platform";

// "Bu akşamki seansım" story kartı (9:16). Pellix hesabının "Günün Seansı" kartıyla aynı aile:
// arka plan Keşfet'teki gibi afişin bulanık hâli, ortada afiş, Big Shoulders ad, DM Mono künye,
// NEREDE satırında platform logoları. Kullanıcının kendi puanı ve günlük notu varsa onlar görünür.
// 360x640 çiziliyor; telefon ekran yoğunluğuyla (3x) yakalanınca 1080x1920 oluyor.
export const STORY_CARD_WIDTH = 360;
export const STORY_CARD_HEIGHT = 640;

const CREAM = "#f3ead8";
const DIM = "#8c8579";
const FAINT = "rgba(243,234,216,0.13)";
const GOLD = "#c9a44c";

// Türkçe adlarda "i" → "İ"; yabancı adlar ("Inception") düz büyük harf.
const trUpper = (s) => String(s || "").replace(/i/g, "İ").replace(/ı/g, "I").toUpperCase();

// Big Shoulders ExtraBold'un harf genişlikleri (em cinsinden; ölçülmüş). Ad en fazla iki satıra,
// en büyük puntoyla sığdırılıyor; satırları biz böldüğümüz için iki platformda da aynı görünüyor.
const NARROW = new Set(["I", "İ", "1", ".", ",", ":", ";", "!", "'", "’"]);
const SLIM = new Set(["E", "F", "L", "T", "Z", "Y", "X"]);
function glyphWidth(ch) {
  if (ch === " ") return 0.22;
  if (NARROW.has(ch)) return 0.25;
  if (ch === "M" || ch === "W") return 0.82;
  if (ch === "N" || ch === "&") return 0.61;
  if (SLIM.has(ch)) return 0.43;
  return 0.5;
}
function fitTitle(text, maxWidth = 288, maxFs = 43, minFs = 21, maxLines = 2) {
  const raw = String(text).split(/\s+/).filter(Boolean);
  const words = [];
  // "7." ya da "VE" gibi kısa parçalar tek başına satırda kalmasın
  for (let i = 0; i < raw.length; i++) words.push(raw[i].length <= 2 && i < raw.length - 1 ? `${raw[i]} ${raw[++i]}` : raw[i]);
  const width = (str, fs) => [...str].reduce((sum, ch) => sum + glyphWidth(ch) * fs + 0.17, 0);
  for (let fs = maxFs; fs >= minFs; fs -= 1.5) {
    const rows = [];
    let cur = "";
    for (const word of words) {
      const next = cur ? `${cur} ${word}` : word;
      if (width(next, fs) <= maxWidth) cur = next;
      else { if (cur) rows.push(cur); cur = word; }
    }
    if (cur) rows.push(cur);
    if (rows.length <= maxLines && rows.every((r) => width(r, fs) <= maxWidth)) return { rows, fs };
  }
  return { rows: [String(text)], fs: minFs };
}

// Süre metni API'den Türkçe geliyor ("142 dk", "1 Sezon · 5 Bölüm"); İngilizce kartta çevriliyor.
function localRuntime(runtime) {
  const text = String(runtime || "");
  if (getLanguage() !== "en") return text;
  const plural = (n, one, many) => `${n} ${Number(n) === 1 ? one : many}`;
  return text
    .replace(/(\d+)\s*dk\b/gi, "$1 min")
    .replace(/(\d+)\s*Sezon/g, (_, n) => plural(n, "Season", "Seasons"))
    .replace(/(\d+)\s*Bölüm/g, (_, n) => plural(n, "Episode", "Episodes"));
}

function whereOf(platforms, stores) {
  const subs = (Array.isArray(platforms) ? platforms : [])
    .map((p) => ({ name: platformName(p), logo: platformLogo(p) }))
    .filter((p) => p.name);
  if (subs.length) return { label: translateUI("NEREDE"), items: subs };
  const buy = (Array.isArray(stores) ? stores : []).filter((s) => s && s.store).map((s) => ({ name: s.store, logo: s.logo || null }));
  if (buy.length) return { label: translateUI("KİRALA / SATIN AL"), items: buy };
  return { label: translateUI("NEREDE"), items: [] };
}

export default function TitleStoryCard({ movie, platforms, stores, username, rating, note }) {
  const turkishTitle = String(movie?.originalLanguage || "").toLowerCase() === "tr" || /[çğıöşüÇĞİÖŞÜ]/.test(movie?.title || "");
  const title = turkishTitle ? trUpper(movie?.title) : String(movie?.title || "").toUpperCase();
  const { rows, fs } = fitTitle(title);
  const meta = [movie?.type && translateUI(movie.type), movie?.year, localRuntime(movie?.runtime)].filter(Boolean).map((x) => upperTR(String(x))).join("  ·  ");
  const genres = (Array.isArray(movie?.genres) && movie.genres.length ? movie.genres : movie?.genre ? [movie.genre] : [])
    .slice(0, 2).map((g) => translateUI(g)).join(" · ");
  const where = whereOf(platforms ?? movie?.platforms, stores ?? movie?.stores);
  const logos = where.items.filter((x) => x.logo).slice(0, 3);
  const myScore = Number(rating);
  const hasMyScore = Number.isFinite(myScore) && myScore >= 1;
  const imdb = Number(movie?.imdb) > 0 ? Number(movie.imdb).toFixed(1) : null;
  const cleanNote = String(note || "").trim();
  const bg = movie?.poster ? String(movie.poster).replace(/\/w(500|780)\//, "/w185/") : null;

  return (
    <View style={styles.card} collapsable={false}>
      {!!bg && <Image source={{ uri: bg }} style={styles.amb} blurRadius={48} resizeMode="cover" />}
      <LinearGradient
        colors={["rgba(13,13,16,0.46)", "rgba(13,13,16,0.18)", "rgba(13,13,16,0.22)", "rgba(13,13,16,0.62)", "rgba(13,13,16,0.84)"]}
        locations={[0, 0.26, 0.5, 0.7, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.top}>
        <Text style={styles.brand}>PELLIX</Text>
        <Text style={styles.headline}>{translateUI("BU AKŞAMKİ SEANSIM")}</Text>
      </View>

      {movie?.poster ? (
        <Image source={{ uri: movie.poster }} style={styles.poster} resizeMode="cover" />
      ) : (
        <View style={[styles.poster, styles.posterEmpty]} />
      )}

      <View style={styles.info}>
        <Text style={[styles.title, { fontSize: fs, lineHeight: Math.round(fs * 1.02) }]} numberOfLines={rows.length}>
          {rows.join("\n")}
        </Text>
        {!!meta && <Text style={styles.meta} numberOfLines={1}>{meta}</Text>}
        {!!cleanNote && <Text style={styles.note} numberOfLines={2}>{cleanNote}</Text>}

        <View style={styles.facts}>
          <View style={styles.cell}>
            <Text style={styles.k} numberOfLines={1}>{where.label}</Text>
            {logos.length ? (
              <View style={styles.logos}>
                {logos.map((x) => <Image key={x.name} source={{ uri: x.logo }} style={styles.logo} accessibilityLabel={x.name} />)}
              </View>
            ) : (
              <Text style={styles.v} numberOfLines={1}>{where.items.slice(0, 2).map((x) => x.name).join(" · ") || "—"}</Text>
            )}
          </View>
          <View style={[styles.cell, styles.cellSep]}>
            <Text style={styles.k} numberOfLines={1}>{translateUI("TÜR")}</Text>
            <Text style={[styles.v, styles.vWrap]} numberOfLines={2}>{genres || "—"}</Text>
          </View>
          <View style={[styles.cell, styles.cellSep]}>
            <Text style={styles.k} numberOfLines={1}>{hasMyScore ? translateUI("PUANIM") : imdb ? "IMDb" : translateUI("PUAN")}</Text>
            {hasMyScore ? (
              <Text style={styles.score}>
                {Math.round(myScore)}
                <Text style={styles.scoreOut}>/10</Text>
              </Text>
            ) : (
              <Text style={styles.score}>{imdb || "—"}</Text>
            )}
          </View>
        </View>
      </View>

      <View style={styles.foot}>
        {!!username && (
          <>
            <Text style={styles.footText}>@{username}</Text>
            <Text style={[styles.footText, { opacity: 0.5 }]}>·</Text>
          </>
        )}
        <Text style={[styles.footText, { color: CREAM }]}>pellix.app</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: STORY_CARD_WIDTH, height: STORY_CARD_HEIGHT, backgroundColor: "#100e10", overflow: "hidden" },
  amb: { position: "absolute", left: -33, right: -33, top: -33, bottom: -33, opacity: 0.62, transform: [{ scale: 1.16 }] },
  top: { position: "absolute", left: 30, right: 30, top: 32, flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  brand: { fontFamily: FONTS.marquee, fontSize: 11.5, letterSpacing: 3, color: GOLD },
  headline: { fontFamily: FONTS.monoMedium, fontSize: 7.4, letterSpacing: 1.3, color: "rgba(243,234,216,0.75)" },
  poster: {
    position: "absolute", top: 73, left: (STORY_CARD_WIDTH - 187) / 2, width: 187, height: 280, borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.1)",
    shadowColor: "#000", shadowOpacity: 0.6, shadowRadius: 18, shadowOffset: { width: 0, height: 13 }, elevation: 14,
  },
  posterEmpty: { backgroundColor: "rgba(255,255,255,0.06)" },
  info: { position: "absolute", left: 30, right: 30, top: 373, alignItems: "center" },
  title: { fontFamily: FONTS.marquee, color: CREAM, textAlign: "center", letterSpacing: 0.17 },
  meta: { marginTop: 7, fontFamily: FONTS.monoMedium, fontSize: 8, letterSpacing: 1.3, color: "rgba(243,234,216,0.62)", textAlign: "center" },
  note: { marginTop: 12, maxWidth: 273, fontSize: 13, lineHeight: 17.5, fontStyle: "italic", color: "rgba(243,234,216,0.9)", textAlign: "center" },
  facts: {
    marginTop: 15, alignSelf: "stretch", flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: FAINT,
  },
  cell: { flex: 1, paddingVertical: 8, paddingHorizontal: 3, alignItems: "center" },
  cellSep: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: FAINT },
  k: { fontFamily: FONTS.monoMedium, fontSize: 6.7, letterSpacing: 1.3, color: DIM },
  v: { marginTop: 5, fontSize: 10, fontWeight: "600", color: CREAM },
  vWrap: { lineHeight: 12.5, textAlign: "center" },
  logos: { marginTop: 4, flexDirection: "row", gap: 4 },
  logo: { width: 20, height: 20, borderRadius: 4.7, borderWidth: 0.7, borderColor: "rgba(255,255,255,0.28)" },
  score: { marginTop: 3, fontFamily: FONTS.marquee, fontSize: 15.5, lineHeight: 18, color: GOLD },
  scoreOut: { fontSize: 8.5, color: "rgba(201,164,76,0.7)" },
  foot: { position: "absolute", left: 30, right: 30, bottom: 30, flexDirection: "row", justifyContent: "center", gap: 9 },
  footText: { fontFamily: FONTS.monoMedium, fontSize: 8, letterSpacing: 1.3, color: DIM },
});
