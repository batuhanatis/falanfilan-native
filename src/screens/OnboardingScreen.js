import React, { useState, useEffect, useRef } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Animated } from "react-native";
import { Heart, ChevronLeft, Sparkles } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { hapticSuccess } from "../utils/haptics";
import { emitLocalEvent } from "../utils/localEvents";
import TasteSurveyStep from "../components/TasteSurveyStep";

// ÖNEMLİ (mimari): Onboarding artık İKİ ADIM — 1) kısa bir zevk anketi (türler + en sevdiğin
// film/dizi), 2) mevcut "en az 5 içerik beğen" akışı. Bu ekran react-navigation yığınının
// PARÇASI değil (App.js'in Gate bileşeni tarafından doğrudan render ediliyor, bkz.
// !auth.onboardingCompleted), bu yüzden adımlar arası geçiş react-navigation DEĞİL, basit bir
// yerel "step" state'i ile yönetiliyor.
export default function OnboardingScreen() {
  const { c } = useAppTheme();
  const { auth, markOnboardingComplete } = useAuth();
  const styles = makeStyles(c);
  // OB1 — eskiden hiçbir karşılama/marka anı olmadan direkt forma düşülüyordu. Artık kısa bir
  // "0. adım" var: logo + tagline, dokununca gerçek akış (zevk anketi) başlıyor.
  const [step, setStep] = useState(0);

  async function finishOnboarding() {
    await markOnboardingComplete();
  }

  if (step === 0) {
    return <WelcomeStep c={c} styles={styles} name={auth?.name?.split(" ")[0]} onContinue={() => setStep(1)} />;
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

  return (
    <LikePicksStep
      c={c}
      styles={styles}
      auth={auth}
      onBack={() => setStep(1)}
      onSkip={finishOnboarding}
      onFinish={finishOnboarding}
    />
  );
}

// ---- Adım 0: karşılama/marka anı (OB1) ----
function WelcomeStep({ c, styles, name, onContinue }) {
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
      <TouchableOpacity style={styles.welcomeBtn} onPress={onContinue}>
        <Text style={styles.welcomeBtnText}>Başlayalım</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---- Adım 2: en az 5 içerik beğen (mevcut akış, aynen korunuyor) ----
function LikePicksStep({ c, styles, auth, onBack, onSkip, onFinish }) {
  const [movies, setMovies] = useState([]);
  const [picked, setPicked] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Tek sayfa (film+dizi ~40 ham sonuç) yetersiz kalıyordu — kalite filtresi (IMDB≥6,
      // 100binden fazla oy) bazılarını elediği için elde kalan çok azdı. 6 sayfa (film+dizi
      // için toplam 12 istek) çekip birleştiriyoruz, bu genelde 100+ içerik sağlıyor.
      // ÖNEMLİ (tanıdıklık düzeltmesi): Eskiden Discover ile AYNI rastgele sıralamayı
      // kullanıyorduk — yeni kullanıcılar ilk açılışta hiç duymadıkları, niş içeriklerle
      // karşılaşıyordu. "sort=popular" ile, Discover'ın kendi rastgele akışına HİÇ dokunmadan,
      // sadece bu ekrana özel olarak en çok oy alan (en tanınan) içerikleri en üste çekiyoruz —
      // sayfa/limit yapısı aynen koruyor, sadece backend'de o sayfanın karşılığı artık popülerlik
      // sırasına göre "kaydırılıyor" (offset), rastgele değil.
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
    // OB2 — 5 beğeni eşiğine ulaşınca (kişiselleştirmeyi açan an) artık buton sessizce
    // aktifleşmiyor, bir haptic + kısa bir onay toast'ı ile fark ediliyor.
    const willBeSize = picked.has(id) ? picked.size - 1 : picked.size + 1;
    if (picked.size < 5 && willBeSize >= 5) {
      hapticSuccess();
      emitLocalEvent({ type: "toast", title: "Zevkini öğrendik! 🎬", message: "Artık sana özel öneriler hazırlayabiliriz." });
    }
    setPicked((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
    api.recordInteraction(auth.token, id, "like").catch(() => {});
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

      <View style={styles.footer}>
        <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
          <Text style={styles.skipText}>Atla</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.continueBtn, !done && { backgroundColor: c.surface2 }]} disabled={!done} onPress={onFinish}>
          <Text style={[styles.continueText, !done && { color: c.dim }]}>
            {done ? "Devam Et" : `${5 - count} beğeni daha`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// İki noktalı adım göstergesi — hangi adımda olduğumuzu gösteren minimal bir ilerleme çubuğu.
function StepDots({ c, activeStep }) {
  return (
    <View style={{ flexDirection: "row", gap: 6, marginBottom: 14 }}>
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
  });
}
