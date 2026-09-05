import React, { useState, useEffect, useRef } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Animated } from "react-native";
import { Heart, ChevronLeft, Sparkles } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { hapticSuccess } from "../utils/haptics";
import { emitLocalEvent } from "../utils/localEvents";
import TasteSurveyStep from "../components/TasteSurveyStep";

// Onboarding: 1) kısa zevk anketi, 2) en az 5 içerikle hızlı kalibrasyon,
// 3) kullanıcının verdiği sinyalin gerçekten işe yaradığını hissettiren kısa bir "taste reveal".
// Bu ekran react-navigation yığınının parçası değil; App.js Gate tarafından doğrudan render ediliyor.
export default function OnboardingScreen() {
  const { c } = useAppTheme();
  const { auth, markOnboardingComplete } = useAuth();
  const styles = makeStyles(c);
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [tasteReveal, setTasteReveal] = useState(null);

  async function finishOnboarding() {
    await markOnboardingComplete();
  }

  if (step === 0) {
    return <WelcomeStep c={c} styles={styles} insets={insets} name={auth?.name?.split(" ")[0]} onContinue={() => setStep(1)} />;
  }

  if (step === 1) {
    return (
      <TasteSurveyStep
        title={`Zevkini tanıyalım, ${auth?.name?.split(" ")[0] || ""}`}
        subtitle="Birkaç soru, sana çok daha isabetli öneriler sunmamızı sağlıyor."
        topExtra={<StepDots c={c} activeStep={1} />}
        onSkip={finishOnboarding}
        onContinue={() => setStep(2)}
      />
    );
  }

  if (step === 2) {
    return (
      <LikePicksStep
        c={c}
        styles={styles}
        auth={auth}
        insets={insets}
        onBack={() => setStep(1)}
        onSkip={finishOnboarding}
        onFinish={(reveal) => {
          setTasteReveal(reveal);
          setStep(3);
        }}
      />
    );
  }

  return (
    <TasteRevealStep
      c={c}
      styles={styles}
      insets={insets}
      name={auth?.name?.split(" ")[0]}
      reveal={tasteReveal}
      onFinish={finishOnboarding}
    />
  );
}

// ---- Adım 0: karşılama/marka anı ----
function WelcomeStep({ c, styles, insets, name, onContinue }) {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, bounciness: 10 }),
      Animated.timing(opacity, { toValue: 1, duration: 450, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <View style={styles.welcomeWrap}>
      <Animated.View style={{ opacity, transform: [{ scale }], alignItems: "center" }}>
        <Text style={styles.welcomeLogo}>
          pell<Text style={{ color: c.accent }}>i</Text>x
        </Text>
        <Sparkles size={18} color={c.accent} style={{ marginTop: 14, marginBottom: 10 }} />
        <Text style={styles.welcomeTitle}>{name ? `Hoş geldin, ${name}` : "Hoş geldin"}</Text>
        <Text style={styles.welcomeSubtitle}>Birkaç soru soralım, sana özel bir akış kuralım.</Text>
      </Animated.View>
      <TouchableOpacity style={[styles.welcomeBtn, { bottom: Math.max(24, insets.bottom + 16) }]} onPress={onContinue}>
        <Text style={styles.welcomeBtnText}>Başlayalım</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---- Adım 2: en az 5 içerik beğen ----
function LikePicksStep({ c, styles, auth, insets, onBack, onSkip, onFinish }) {
  const [movies, setMovies] = useState([]);
  const [picked, setPicked] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const pageNumbers = [1, 2, 3, 4, 5, 6];
      const requests = pageNumbers.flatMap((page) => [
        api.movies(auth.token, "movie", page, "popular").catch(() => ({ results: [] })),
        api.movies(auth.token, "tv", page, "popular").catch(() => ({ results: [] })),
      ]);
      const responses = await Promise.all(requests);
      const all = responses.flatMap((r) => r.results || []);
      const byId = new Map();
      all.forEach((m) => byId.set(m.id, m));
      setMovies([...byId.values()]);
      setLoading(false);
    })();
  }, []);

  function toggle(id) {
    const willBeSize = picked.has(id) ? picked.size - 1 : picked.size + 1;
    if (picked.size < 5 && willBeSize >= 5) {
      hapticSuccess();
      emitLocalEvent({ type: "toast", title: "Zevkini öğrendik! 🎬", message: "Artık sana özel öneriler hazırlayabiliriz." });
    }

    const wasPicked = picked.has(id);
    setPicked((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
    if (wasPicked) api.removeInteraction(auth.token, id, "like").catch(() => {});
    else api.recordInteraction(auth.token, id, "like").catch(() => {});
  }

  function continueWithReveal() {
    const selectedMovies = movies.filter((m) => picked.has(m.id));
    onFinish(buildTasteReveal(selectedMovies));
  }

  const count = picked.size;
  const done = count >= 5;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: 60 }}>
      <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
        <View style={styles.stepHeaderRow}>
          <TouchableOpacity onPress={onBack} style={{ padding: 2, marginLeft: -2 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ChevronLeft size={18} color={c.dim} />
          </TouchableOpacity>
          <StepDots c={c} activeStep={2} />
        </View>
        <Text style={styles.title}>Son bir adım</Text>
        <Text style={styles.subtitle}>Sana özel öneriler üretebilmemiz için en az 5 film/dizi beğen.</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(count / 5, 1) * 100}%` }]} />
        </View>
        <Text style={styles.progressLabel}>{count}/5</Text>
      </View>

      <FlatList
        data={movies}
        keyExtractor={(item) => String(item.id)}
        numColumns={3}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => {
          const isPicked = picked.has(item.id);
          return (
            <TouchableOpacity style={styles.posterWrap} onPress={() => toggle(item.id)} activeOpacity={0.85}>
              {item.poster ? (
                <Image source={{ uri: item.poster }} style={[styles.poster, isPicked && styles.posterPicked]} />
              ) : (
                <View style={[styles.poster, { backgroundColor: c.surface2 }]} />
              )}
              <View style={[styles.heartBadge, isPicked && { backgroundColor: c.accent2 }]}>
                <Heart size={12} color="#fff" fill={isPicked ? "#fff" : "none"} />
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
        <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
          <Text style={styles.skipText}>Atla</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.continueBtn, !done && { backgroundColor: c.surface2 }]} disabled={!done} onPress={continueWithReveal}>
          <Text style={[styles.continueText, !done && { color: c.dim }]}>
            {done ? "Zevkimi Göster" : `${5 - count} beğeni daha`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function buildTasteReveal(selectedMovies) {
  const genreCounts = {};
  selectedMovies.forEach((movie) => {
    const rawGenres = Array.isArray(movie.genres) && movie.genres.length
      ? movie.genres
      : typeof movie.genre === "string"
        ? movie.genre.split(",")
        : [];
    rawGenres.forEach((genre) => {
      const key = String(genre || "").trim();
      if (!key) return;
      genreCounts[key] = (genreCounts[key] || 0) + 1;
    });
  });

  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([genre]) => genre);

  return {
    topGenres,
    picks: selectedMovies.filter((m) => !!m.poster).slice(0, 4),
  };
}

// ---- Payoff: kullanıcının verdiği sinyalin anında bir karşılığı olduğunu göster ----
function TasteRevealStep({ c, styles, insets, name, reveal, onFinish }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    hapticSuccess();
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 8 }),
    ]).start();
  }, []);

  const topGenres = reveal?.topGenres?.length ? reveal.topGenres : ["Sana özel", "Keşif", "Sürpriz"];
  const picks = reveal?.picks || [];

  return (
    <View style={styles.revealWrap}>
      <Animated.View style={[styles.revealContent, { opacity, transform: [{ scale }] }]}>
        <View style={styles.revealSparkleRing}>
          <Sparkles size={28} color={c.accent} />
        </View>
        <Text style={styles.revealEyebrow}>PELLIX TASTE</Text>
        <Text style={styles.revealTitle}>{name ? `${name}, zevkini yakaladık` : "Zevkini yakaladık"}</Text>
        <Text style={styles.revealSubtitle}>İlk seçimlerine göre akışını şekillendirmeye başladık. Kullandıkça bu profil daha da netleşecek.</Text>

        <View style={styles.genreRow}>
          {topGenres.map((genre) => (
            <View key={genre} style={styles.genreChip}>
              <Text style={styles.genreChipText}>{genre}</Text>
            </View>
          ))}
        </View>

        {picks.length > 0 && (
          <View style={styles.revealPosterRow}>
            {picks.map((movie, index) => (
              <Image
                key={movie.id}
                source={{ uri: movie.poster }}
                style={[styles.revealPoster, { transform: [{ rotate: `${(index - (picks.length - 1) / 2) * 3}deg` }] }]}
              />
            ))}
          </View>
        )}

        <View style={styles.revealPromise}>
          <Text style={styles.revealPromiseTitle}>İlk önerilerin hazır</Text>
          <Text style={styles.revealPromiseText}>Ana Sayfa ve Keşfet artık verdiğin bu sinyallerle başlayacak.</Text>
        </View>
      </Animated.View>

      <TouchableOpacity style={[styles.revealBtn, { bottom: Math.max(24, insets.bottom + 16) }]} onPress={onFinish} activeOpacity={0.88}>
        <Text style={styles.revealBtnText}>Pellix'e Gir</Text>
      </TouchableOpacity>
    </View>
  );
}

// İki kalibrasyon adımını gösteren minimal ilerleme çubuğu.
function StepDots({ c, activeStep }) {
  return (
    <View style={{ flexDirection: "row", gap: 6, marginBottom: 14, flex: 1, marginLeft: 12 }}>
      {[1, 2].map((step) => (
        <View
          key={step}
          style={{
            flex: 1, height: 4, borderRadius: 999,
            backgroundColor: step <= activeStep ? c.accent : c.surface2,
          }}
        />
      ))}
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg },
    welcomeWrap: { flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", padding: 30 },
    welcomeLogo: { fontFamily: "Baloo2_800ExtraBold", fontSize: 34, color: c.text },
    welcomeTitle: { fontSize: 19, fontWeight: "800", color: c.text, textAlign: "center" },
    welcomeSubtitle: { fontSize: 13, color: c.dim, marginTop: 8, textAlign: "center", lineHeight: 19 },
    welcomeBtn: {
      position: "absolute", bottom: 50, left: 30, right: 30,
      backgroundColor: c.accent, borderRadius: 14, paddingVertical: 15, alignItems: "center",
    },
    welcomeBtnText: { color: c.bg, fontWeight: "800", fontSize: 14 },
    title: { color: c.text, fontSize: 20, fontWeight: "800" },
    subtitle: { color: c.dim, fontSize: 12.5, marginTop: 5, lineHeight: 18 },
    stepHeaderRow: { flexDirection: "row", alignItems: "flex-start" },

    progressTrack: { height: 6, borderRadius: 999, backgroundColor: c.surface2, marginTop: 12, overflow: "hidden" },
    progressFill: { height: "100%", backgroundColor: c.accent },
    progressLabel: { color: c.dim, fontSize: 11, marginTop: 4, textAlign: "right" },
    posterWrap: { flex: 1 / 3, aspectRatio: 2 / 3, margin: 4, position: "relative" },
    poster: { width: "100%", height: "100%", borderRadius: 10 },
    posterPicked: { opacity: 0.75 },
    heartBadge: {
      position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 999,
      backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center",
    },
    footer: { flexDirection: "row", gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: c.border },
    skipBtn: { paddingHorizontal: 18, justifyContent: "center", borderRadius: 14, borderWidth: 1, borderColor: c.border },
    skipText: { color: c.dim, fontWeight: "700", fontSize: 13 },
    continueBtn: { flex: 1, backgroundColor: c.accent, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
    continueText: { color: c.bg, fontWeight: "800", fontSize: 14 },

    revealWrap: { flex: 1, backgroundColor: c.bg, paddingHorizontal: 24, justifyContent: "center" },
    revealContent: { alignItems: "center", paddingBottom: 88 },
    revealSparkleRing: {
      width: 72, height: 72, borderRadius: 999, alignItems: "center", justifyContent: "center",
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.accent, marginBottom: 16,
    },
    revealEyebrow: { color: c.accent, fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
    revealTitle: { color: c.text, fontSize: 24, fontWeight: "900", textAlign: "center", marginTop: 7 },
    revealSubtitle: { color: c.dim, fontSize: 13, lineHeight: 19, textAlign: "center", maxWidth: 330, marginTop: 8 },
    genreRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 20 },
    genreChip: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 },
    genreChipText: { color: c.text, fontSize: 11.5, fontWeight: "800" },
    revealPosterRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 24, minHeight: 128 },
    revealPoster: { width: 76, height: 114, borderRadius: 10, marginHorizontal: -5, borderWidth: 2, borderColor: c.bg },
    revealPromise: { marginTop: 22, width: "100%", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 14 },
    revealPromiseTitle: { color: c.text, fontSize: 13.5, fontWeight: "800", textAlign: "center" },
    revealPromiseText: { color: c.dim, fontSize: 11.5, lineHeight: 17, textAlign: "center", marginTop: 4 },
    revealBtn: { position: "absolute", left: 24, right: 24, backgroundColor: c.accent, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
    revealBtnText: { color: c.bg, fontWeight: "900", fontSize: 14 },
  });
}
