import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Eye, Gamepad2, Share2, Sparkles, X } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { hapticLight, hapticSuccess } from "../utils/haptics";
import ScreenHeader from "../components/ScreenHeader";
import ShareCardModal from "../components/ShareCardModal";
import PosterPuzzleShareCard from "../components/PosterPuzzleShareCard";

const MAX_WRONG = 3;
const BLUR_LEVELS = [34, 20, 9, 0];

function localDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localDayNumber() {
  const now = new Date();
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86400000);
}

function puzzleStorageKey() {
  return `pellix_daily_poster_puzzle_${localDateKey()}`;
}

function resultStorageKey() {
  return `pellix_daily_poster_result_${localDateKey()}`;
}

function dedupe(items) {
  const byId = new Map();
  (items || []).forEach((item) => {
    if (item?.id && item?.title && item?.poster) byId.set(item.id, item);
  });
  return [...byId.values()];
}

function makePuzzle(pool) {
  if (pool.length < 4) return null;
  const day = Math.abs(localDayNumber());
  const targetIndex = day % pool.length;
  const target = pool[targetIndex];
  const optionIndexes = [targetIndex];
  const strides = [5, 11, 17, 23, 31];

  for (const stride of strides) {
    const idx = (targetIndex + stride + day) % pool.length;
    if (!optionIndexes.includes(idx)) optionIndexes.push(idx);
    if (optionIndexes.length === 4) break;
  }

  for (let i = 0; optionIndexes.length < 4 && i < pool.length; i += 1) {
    const idx = (targetIndex + i + 1) % pool.length;
    if (!optionIndexes.includes(idx)) optionIndexes.push(idx);
  }

  const options = optionIndexes.map((idx) => ({
    id: pool[idx].id,
    title: pool[idx].title,
    year: pool[idx].year,
    type: pool[idx].type,
  }));
  const shift = day % options.length;
  const rotated = [...options.slice(shift), ...options.slice(0, shift)];

  return {
    date: localDateKey(),
    target: {
      id: target.id,
      title: target.title,
      poster: target.poster,
      year: target.year,
      type: target.type,
    },
    options: rotated,
  };
}

function resultSquares(result) {
  if (!result) return "";
  const wrong = Math.min(result.wrongCount || 0, MAX_WRONG);
  if (!result.correct) return "🟥".repeat(MAX_WRONG);
  return `${"🟥".repeat(wrong)}🟩${"⬛".repeat(Math.max(0, MAX_WRONG - wrong - 1))}`;
}

export default function DailyPosterPuzzleScreen({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c, insets), [c, insets.bottom]);

  const [loading, setLoading] = useState(true);
  const [puzzle, setPuzzle] = useState(null);
  const [wrongIds, setWrongIds] = useState(new Set());
  const [result, setResult] = useState(null);
  const [showShareCard, setShowShareCard] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [savedPuzzleRaw, savedResultRaw] = await Promise.all([
          AsyncStorage.getItem(puzzleStorageKey()),
          AsyncStorage.getItem(resultStorageKey()),
        ]);

        if (savedPuzzleRaw) {
          const savedPuzzle = JSON.parse(savedPuzzleRaw);
          if (!cancelled) setPuzzle(savedPuzzle);
          if (savedResultRaw && !cancelled) setResult(JSON.parse(savedResultRaw));
          if (!cancelled) setLoading(false);
          return;
        }

        const [movies, shows] = await Promise.all([
          api.movies(auth.token, "movie", 1, "popular").catch(() => ({ results: [] })),
          api.movies(auth.token, "tv", 1, "popular").catch(() => ({ results: [] })),
        ]);
        const pool = dedupe([...(movies.results || []), ...(shows.results || [])]);
        const generated = makePuzzle(pool);
        if (generated) await AsyncStorage.setItem(puzzleStorageKey(), JSON.stringify(generated));
        if (!cancelled) setPuzzle(generated);
      } catch {
        if (!cancelled) setPuzzle(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [auth.token]);

  async function finish(nextResult) {
    setResult(nextResult);
    try { await AsyncStorage.setItem(resultStorageKey(), JSON.stringify(nextResult)); } catch {}
  }

  function choose(option) {
    if (!puzzle || result || wrongIds.has(option.id)) return;
    hapticLight();

    if (Number(option.id) === Number(puzzle.target.id)) {
      hapticSuccess();
      finish({ correct: true, wrongCount: wrongIds.size, solvedAt: new Date().toISOString() });
      return;
    }

    const nextWrong = new Set(wrongIds);
    nextWrong.add(option.id);
    setWrongIds(nextWrong);
    if (nextWrong.size >= MAX_WRONG) {
      finish({ correct: false, wrongCount: nextWrong.size, solvedAt: new Date().toISOString() });
    }
  }

  function shareResult() {
    if (!result || !puzzle) return;
    setShowShareCard(true);
  }

  const wrongCount = result ? result.wrongCount : wrongIds.size;
  const blur = result ? 0 : BLUR_LEVELS[Math.min(wrongCount, BLUR_LEVELS.length - 1)];

  return (
    <View style={styles.root}>
      <ScreenHeader title="Poster Puzzle" subtitle="Bugünün oyunu" onBack={() => navigation.goBack()} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={c.accent} />
          <Text style={styles.loadingText}>Bugünün posteri hazırlanıyor…</Text>
        </View>
      ) : !puzzle ? (
        <View style={styles.center}>
          <Eye size={28} color={c.dim} />
          <Text style={styles.emptyTitle}>Bugünkü bulmaca hazırlanamadı</Text>
          <Text style={styles.emptyText}>Bağlantını kontrol edip biraz sonra tekrar deneyebilirsin.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <LinearGradient colors={["#6D28D9", "#4F46E5", "#2563EB"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={styles.heroGlow} />
            <Sparkles size={19} color="rgba(255,255,255,0.30)" style={styles.heroSparkle} />
            <Text style={styles.heroEyebrow}>HER GÜN TEK POSTER</Text>
            <Text style={styles.heroTitle}>{result ? (result.correct ? "Bildin! 🎉" : "Bugün olmadı") : "Bulanıklık açılmadan filmi bul"}</Text>
            <Text style={styles.heroSubtitle}>
              {result
                ? (result.correct ? `${wrongCount + 1}. denemede doğru cevabı buldun.` : `Doğru cevap ${puzzle.target.title} idi.`)
                : `Yanlış yaptıkça poster biraz daha netleşir. ${MAX_WRONG} hata hakkın var.`}
            </Text>
          </LinearGradient>

          <View style={styles.posterCard}>
            <Image source={{ uri: puzzle.target.poster }} style={styles.poster} blurRadius={blur} resizeMode="cover" />
            {!result && (
              <View style={styles.blurBadge}>
                <Eye size={12} color="#fff" />
                <Text style={styles.blurBadgeText}>{wrongCount === 0 ? "Çok bulanık" : wrongCount === 1 ? "Biraz açıldı" : "Neredeyse net"}</Text>
              </View>
            )}
            {result && (
              <LinearGradient colors={["transparent", "rgba(0,0,0,0.86)"]} style={StyleSheet.absoluteFillObject}>
                <View style={styles.revealCopy}>
                  <Text style={styles.revealTitle}>{puzzle.target.title}</Text>
                  <Text style={styles.revealMeta}>{puzzle.target.year} · {puzzle.target.type}</Text>
                </View>
              </LinearGradient>
            )}
          </View>

          {!result ? (
            <>
              <View style={styles.attemptRow}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={[styles.attemptDot, i < wrongIds.size && styles.attemptDotWrong]}>
                    {i < wrongIds.size ? <X size={11} color="#fff" /> : <Text style={styles.attemptDotText}>{i + 1}</Text>}
                  </View>
                ))}
                <Text style={styles.attemptLabel}>{MAX_WRONG - wrongIds.size} hata hakkı kaldı</Text>
              </View>

              <Text style={styles.question}>Bu poster hangisine ait?</Text>
              <View style={styles.options}>
                {puzzle.options.map((option) => {
                  const wrong = wrongIds.has(option.id);
                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[styles.option, wrong && styles.optionWrong]}
                      onPress={() => choose(option)}
                      disabled={wrong}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.optionIcon, wrong && { backgroundColor: "rgba(239,68,68,0.14)" }]}>
                        {wrong ? <X size={14} color="#EF4444" /> : <Gamepad2 size={14} color={c.accent} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.optionTitle, wrong && { color: c.dim }]}>{option.title}</Text>
                        <Text style={styles.optionMeta}>{option.year} · {option.type}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : (
            <View style={styles.resultBlock}>
              <Text style={styles.squares}>{resultSquares(result)}</Text>
              <Text style={styles.resultLabel}>{result.correct ? "Bugünün bulmacası tamamlandı" : "Yarın yeni bir poster gelecek"}</Text>

              <TouchableOpacity style={styles.shareBtn} onPress={shareResult} activeOpacity={0.86}>
                <Share2 size={16} color={c.bg} />
                <Text style={styles.shareBtnText}>Sonucumu Paylaş</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.playMoreBtn} onPress={() => navigation.replace("PellixPlay")} activeOpacity={0.84}>
                <Gamepad2 size={15} color={c.text} />
                <Text style={styles.playMoreText}>Diğer Pellix Play Oyunları</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {showShareCard && result && puzzle && (
        <ShareCardModal
          onClose={() => setShowShareCard(false)}
          shareMessage={`Pellix Poster Puzzle · ${localDateKey()}\n${resultSquares(result)}\n${result.correct ? `Posteri ${Number(result.wrongCount || 0) + 1}. denemede bildim 🎬` : "Bugün poster beni yendi 😅"}\nCevabı göstermiyorum. Sen kaçta bulursun?`}
          socialCard={{
            kind: "poster_puzzle",
            date: localDateKey(),
            correct: !!result.correct,
            wrongCount: Number(result.wrongCount || 0),
            attempts: result.correct ? Number(result.wrongCount || 0) + 1 : MAX_WRONG,
            squares: resultSquares(result),
          }}
          previewHeight={458}
        >
          <PosterPuzzleShareCard
            date={localDateKey()}
            correct={!!result.correct}
            wrongCount={Number(result.wrongCount || 0)}
            squares={resultSquares(result)}
          />
        </ShareCardModal>
      )}
    </View>
  );
}

function makeStyles(c, insets) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
    loadingText: { fontSize: 11.5, color: c.dim, marginTop: 10 },
    emptyTitle: { fontSize: 15, fontWeight: "800", color: c.text, marginTop: 10 },
    emptyText: { fontSize: 11.5, color: c.dim, textAlign: "center", marginTop: 5, lineHeight: 17 },
    content: { padding: 18, paddingBottom: Math.max(34, insets.bottom + 24) },
    hero: { borderRadius: 20, padding: 19, overflow: "hidden" },
    heroGlow: { position: "absolute", width: 150, height: 150, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.09)", right: -35, top: -90 },
    heroSparkle: { position: "absolute", top: 15, right: 18 },
    heroEyebrow: { color: "rgba(255,255,255,0.68)", fontSize: 8.5, fontWeight: "900", letterSpacing: 0.9 },
    heroTitle: { color: "#fff", fontSize: 19, fontWeight: "900", marginTop: 5, maxWidth: "88%" },
    heroSubtitle: { color: "rgba(255,255,255,0.80)", fontSize: 11.2, lineHeight: 16, marginTop: 6, maxWidth: "92%" },
    posterCard: { marginTop: 16, aspectRatio: 2 / 3, borderRadius: 22, overflow: "hidden", backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border },
    poster: { width: "100%", height: "100%" },
    blurBadge: { position: "absolute", top: 12, right: 12, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.58)", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
    blurBadgeText: { color: "#fff", fontSize: 9.5, fontWeight: "800" },
    revealCopy: { position: "absolute", left: 16, right: 16, bottom: 15 },
    revealTitle: { color: "#fff", fontSize: 19, fontWeight: "900" },
    revealMeta: { color: "rgba(255,255,255,0.74)", fontSize: 11, marginTop: 2 },
    attemptRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 },
    attemptDot: { width: 25, height: 25, borderRadius: 999, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
    attemptDotWrong: { backgroundColor: "#EF4444", borderColor: "#EF4444" },
    attemptDotText: { color: c.dim, fontSize: 9.5, fontWeight: "800" },
    attemptLabel: { color: c.dim, fontSize: 10.5, fontWeight: "700", marginLeft: 3 },
    question: { color: c.text, fontSize: 15, fontWeight: "900", marginTop: 18, marginBottom: 10 },
    options: { gap: 8 },
    option: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 13, padding: 11 },
    optionWrong: { opacity: 0.55, borderColor: "rgba(239,68,68,0.45)" },
    optionIcon: { width: 31, height: 31, borderRadius: 10, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    optionTitle: { color: c.text, fontSize: 12.5, fontWeight: "800" },
    optionMeta: { color: c.dim, fontSize: 9.5, marginTop: 1 },
    resultBlock: { alignItems: "center", marginTop: 18 },
    squares: { fontSize: 28, letterSpacing: 5 },
    resultLabel: { fontSize: 11.5, color: c.dim, fontWeight: "700", marginTop: 7 },
    shareBtn: { width: "100%", marginTop: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: c.accent, borderRadius: 14, paddingVertical: 14 },
    shareBtnText: { color: c.bg, fontWeight: "900", fontSize: 13 },
    playMoreBtn: { marginTop: 9, width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingVertical: 13 },
    playMoreText: { color: c.text, fontWeight: "800", fontSize: 12.5 },
  });
}
