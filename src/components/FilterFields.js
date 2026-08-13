import React, { useRef, useEffect } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { Shuffle, Check } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { GENRE_FILTERS } from "../theme/theme";
import { GENRE_COLORS } from "../utils/genreColors";
import { YEAR_OPTIONS } from "../utils/filterYears";
import { platformName, platformLogo } from "../utils/platform";
import { hapticLight, hapticMedium } from "../utils/haptics";

const TYPE_OPTIONS = ["Hepsi", "Film", "Dizi"];
// Gerçek logosu olmayan platformlar (COMMON_PLATFORMS sadece isim taşıyor, HomeScreen'in
// gerçek film verisinden türetilen availablePlatformObjs'un aksine) için — icat edilmiş marka
// renkleri yerine, nötr ama canlı, isimden DETERMİNİSTİK seçilen bir palet.
const MONOGRAM_PALETTE = ["#DB2777", "#7C3AED", "#0EA5E9", "#F97316", "#14B8A6", "#DC2626", "#6366F1", "#EAB308"];
function colorForName(name) {
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return MONOGRAM_PALETTE[hash % MONOGRAM_PALETTE.length];
}

// CH2/DC2'deki AYNI "sıçrama" deseni — bir çipe her dokunuşta kısa bir spring pop'u.
function useTapPop() {
  const scale = useRef(new Animated.Value(1)).current;
  function pop() {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.18, useNativeDriver: true, speed: 40, bounciness: 18 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
    ]).start();
  }
  return [scale, pop];
}

function GenreChip({ genre, active, onPress, c, styles }) {
  const [scale, pop] = useTapPop();
  const color = GENRE_COLORS[genre] || c.accent;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => { hapticLight(); pop(); onPress(genre); }}
    >
      <Animated.View
        style={[
          styles.genreChip,
          { backgroundColor: active ? color : `${color}22`, borderColor: active ? color : `${color}55` },
          { transform: [{ scale }] },
        ]}
      >
        <Text style={styles.genreEmoji}>{GENRE_EMOJI[genre] || "🎬"}</Text>
        <Text style={[styles.genreChipText, { color: active ? "#fff" : c.text }]}>{genre}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const GENRE_EMOJI = {
  "Aksiyon": "💥", "Dram": "🎭", "Komedi": "😂", "Bilim Kurgu": "🚀", "Gerilim": "😱",
  "Romantik": "💕", "Belgesel": "🎥", "Suç": "🕵️", "Fantastik": "🧙", "Korku": "👻",
};

// Ana Sayfa'nın filtre paneli, MatchParty davetinin filtreleri ve "Zevkine Göre Öner"in
// kriterleri eskiden ÜÇ AYRI, birbirinden kopya-yapıştır türeyen implementasyondu — aynı Tür/
// Kategori/Yıl/Platform seçimini üç kere, üç farklı görsel dille yazıyorduk. Artık TEK bileşen;
// her ekran sadece kendi state'ini/callback'lerini geçiyor. HomeScreen ve "Zevkine Göre Öner"
// bunu bir IslandModal içinde, MatchParty daveti ise doğrudan sayfanın kendi akışına gömerek kullanıyor.
export default function FilterFields({
  typeValue, onTypeChange,
  genreValue, onGenreChange,
  yearSet, onToggleYear,
  platformSet, onTogglePlatform, platforms = [],
  onShuffleGenre,
  anyActive, onClear,
}) {
  const { c } = useAppTheme();
  const styles = makeStyles(c);
  const normalizedType = typeValue || "Hepsi";
  const typeIndex = TYPE_OPTIONS.indexOf(normalizedType);

  const segAnim = useRef(new Animated.Value(typeIndex)).current;
  useEffect(() => {
    Animated.spring(segAnim, { toValue: typeIndex, useNativeDriver: false, bounciness: 6, speed: 14 }).start();
  }, [typeIndex]);
  const indicatorLeft = segAnim.interpolate({ inputRange: [0, 1, 2], outputRange: ["0%", "33.3333%", "66.6666%"] });

  function shuffle() {
    hapticMedium();
    onShuffleGenre();
  }

  return (
    <View>
      <View style={styles.labelRow}>
        <Text style={styles.sectionLabel}>🎬 TÜR</Text>
        {anyActive && onClear && (
          <TouchableOpacity onPress={onClear} activeOpacity={0.85} style={styles.clearPill}>
            <Text style={styles.clearPillText}>Temizle</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.segmented}>
        <Animated.View style={[styles.segIndicator, { left: indicatorLeft }]} />
        {TYPE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={styles.segBtn}
            onPress={() => { hapticLight(); onTypeChange(opt); }}
          >
            <Text style={[styles.segText, normalizedType === opt && styles.segTextActive]}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.labelRow}>
        <Text style={styles.sectionLabel}>🎨 KATEGORİ</Text>
        {!!onShuffleGenre && (
          <TouchableOpacity onPress={shuffle} activeOpacity={0.85} style={styles.shuffleBtn}>
            <Shuffle size={12} color="#fff" />
            <Text style={styles.shuffleBtnText}>Sürpriz Seç</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.wrapGrid}>
        {GENRE_FILTERS.map((genre) => (
          <GenreChip
            key={genre}
            genre={genre}
            active={genreValue === genre}
            onPress={(g) => onGenreChange(g === genreValue ? null : g)}
            c={c}
            styles={styles}
          />
        ))}
      </View>

      <Text style={styles.sectionLabel}>📅 YAPIM YILI</Text>
      <View style={styles.wrapGrid}>
        {YEAR_OPTIONS.map(([label]) => {
          const active = yearSet.has(label);
          return (
            <TouchableOpacity
              key={label}
              activeOpacity={0.85}
              style={[styles.yearChip, active && { backgroundColor: c.accent, borderColor: c.accent }]}
              onPress={() => { hapticLight(); onToggleYear(label); }}
            >
              <Text style={[styles.yearChipText, active && { color: c.bg, fontWeight: "800" }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {platforms.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>📺 PLATFORM</Text>
          <View style={styles.wrapGrid}>
            {platforms.map((p, i) => {
              const name = platformName(p);
              const logo = platformLogo(p);
              const active = platformSet.has(name);
              return (
                <TouchableOpacity
                  key={`${name}-${i}`}
                  activeOpacity={0.85}
                  onPress={() => { hapticLight(); onTogglePlatform(name); }}
                  style={{ position: "relative" }}
                >
                  <View style={[
                    styles.platTile,
                    logo ? { backgroundColor: "#fff" } : { backgroundColor: colorForName(name) },
                    active && styles.platTileActive,
                  ]}>
                    {logo ? (
                      <Image source={{ uri: logo }} style={styles.platLogo} />
                    ) : (
                      <Text style={styles.platMonogram}>{name?.slice(0, 2)?.toUpperCase()}</Text>
                    )}
                  </View>
                  {active && (
                    <View style={styles.platCheck}>
                      <Check size={9} color={c.bg} strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    sectionLabel: {
      fontSize: 10.5, fontWeight: "800", color: c.dim, letterSpacing: 0.5,
      marginTop: 18, marginBottom: 9,
    },
    labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    shuffleBtn: {
      flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999,
      paddingHorizontal: 11, paddingVertical: 6, backgroundColor: "#DB2777", marginTop: 12,
    },
    shuffleBtnText: { color: "#fff", fontSize: 10.5, fontWeight: "800" },

    segmented: { position: "relative", flexDirection: "row", backgroundColor: c.surface2, borderRadius: 13, padding: 4 },
    segIndicator: { position: "absolute", top: 4, bottom: 4, width: "33.3333%", backgroundColor: c.accent, borderRadius: 9 },
    segBtn: { flex: 1, alignItems: "center", paddingVertical: 9 },
    segText: { fontSize: 12.5, fontWeight: "700", color: c.dim },
    segTextActive: { color: c.bg },

    wrapGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    genreChip: {
      flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1.5,
      paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999,
    },
    genreEmoji: { fontSize: 13 },
    genreChipText: { fontSize: 12, fontWeight: "700" },

    yearChip: {
      borderWidth: 1, borderColor: c.border, backgroundColor: c.surface2,
      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    },
    yearChipText: { fontSize: 11.5, fontWeight: "600", color: c.text },

    platTile: {
      width: 46, height: 46, borderRadius: 13, alignItems: "center", justifyContent: "center", overflow: "hidden",
    },
    platTileActive: { borderWidth: 2, borderColor: c.accent2 },
    platLogo: { width: "100%", height: "100%" },
    platMonogram: { fontSize: 12, fontWeight: "800", color: "#fff" },
    platCheck: {
      position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: 999,
      backgroundColor: c.accent2, borderWidth: 2, borderColor: c.surface, alignItems: "center", justifyContent: "center",
    },

    clearPill: { backgroundColor: `${c.accent}22`, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginTop: 18 },
    clearPillText: { fontSize: 11, fontWeight: "800", color: c.accent },
  });
}
